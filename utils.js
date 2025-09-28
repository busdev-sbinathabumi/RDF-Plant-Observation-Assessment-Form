
export const debounce = (func, waitFor) => {
  let timeout = null;

  return (...args) =>
    new Promise(resolve => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
};
