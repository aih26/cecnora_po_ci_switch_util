// Detects which internal interface_mappings field a column label refers to.
// Used by both the backend import route and the frontend for header labels.
// More specific patterns come first.
export function detectField(label) {
  const l = (label || '').toLowerCase().trim();
  if (!l) return null;

  if (/channel.*(obj|id)|(obj|id).*channel/.test(l))         return 'po_channel_object_id';
  if (/namespace|name\s*space/.test(l))                       return 'po_namespace';
  if (/iflow.*(name|display|title)|(name|display).*iflow/.test(l)) return 'cpi_iflow_name';
  if (/iflow.*(id|ref|key)|(id|ref|key).*iflow/.test(l))      return 'cpi_iflow_id';
  if (/iflow|integration.?flow/.test(l))                      return 'cpi_iflow_id';
  if (/package|pkg/.test(l))                                  return 'cpi_package_id';
  if (/ico|interface.*(name|id)|name.*interface/.test(l))     return 'po_ico_name';
  if (/party/.test(l))                                        return 'po_sender_party';
  if (/service|component|serv|comp/.test(l))                  return 'po_sender_service';
  if (/channel/.test(l))                                      return 'po_channel_name';
  if (/interface/.test(l))                                    return 'po_interface_name';
  if (/note|remark|comment/.test(l))                          return 'notes';
  return null;
}

// Build a field→label map from the csv_column_map array
export function buildColLabels(colMap) {
  const labels = {};
  (colMap || []).filter(c => c.enabled !== false).forEach(c => {
    const field = detectField(c.label);
    if (field && !labels[field]) labels[field] = c.label; // first match wins
  });
  return labels;
}
