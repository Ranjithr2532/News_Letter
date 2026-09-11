export const formatErrorMessage = (err, fallbackMessage = 'An unexpected error occurred.') => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallbackMessage;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.msg) return item.msg;
        return JSON.stringify(item);
      })
      .join(', ');
  }
  if (typeof detail === 'object') {
    return detail.msg || JSON.stringify(detail);
  }
  return String(detail);
};
