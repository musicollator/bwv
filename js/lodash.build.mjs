// lodash.build.mjs

// --- Internal helpers ---
function isObject(value) {
  return value !== null && typeof value === 'object';
}

function now() {
  return typeof Date.now === 'function' ? Date.now() : new Date().getTime();
}

function isSymbol(value) {
  const type = typeof value;
  return type === 'symbol' || (isObject(value) && Object.prototype.toString.call(value) === '[object Symbol]');
}

function isObjectLike(value) {
  return value !== null && typeof value === 'object';
}

function toNumber(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (isSymbol(value)) {
    return NaN;
  }
  if (isObject(value)) {
    const other = typeof value.valueOf === 'function' ? value.valueOf() : value;
    value = isObject(other) ? `${other}` : other;
  }
  if (typeof value !== 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(/^\s+|\s+$/g, '');
  const isBinary = /^0b[01]+$/i.test(value);
  return isBinary ? parseInt(value.slice(2), 2) :
         /^0o[0-7]+$/i.test(value) ? parseInt(value.slice(2), 8) :
         /^[-+]0x[\da-f]+$/i.test(value) ? NaN :
         +value;
}

// --- Binary Search: sortedIndex ---
function baseSortedIndex(array, value, retHighest) {
  let low = 0;
  let high = array == null ? 0 : array.length;

  if (typeof value === 'number' && value === value && high <= 2147483647) {
    while (low < high) {
      const mid = (low + high) >>> 1;
      const computed = array[mid];

      if (computed !== null && !isSymbol(computed)) {
        if (retHighest ? (computed <= value) : (computed < value)) {
          low = mid + 1;
        } else {
          high = mid;
        }
      } else {
        high = mid;
      }
    }
    return high;
  }

  return baseSortedIndexBy(array, value, x => x, retHighest);
}

function baseSortedIndexBy(array, value, iteratee, retHighest) {
  value = iteratee(value);
  let low = 0;
  let high = array == null ? 0 : array.length;
  let valIsNaN = value !== value;
  let valIsNull = value === null;
  let valIsSymbol = isSymbol(value);
  let valIsUndefined = value === undefined;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const computed = iteratee(array[mid]);
    let setLow = false;

    if (valIsNaN) {
      setLow = computed === computed;
    } else if (valIsUndefined) {
      setLow = computed !== undefined && (!retHighest || computed !== undefined);
    } else if (valIsNull) {
      setLow = computed !== null && computed !== undefined && (!retHighest || computed !== null);
    } else if (valIsSymbol) {
      setLow = !isSymbol(computed) && (computed !== undefined && computed !== null) && (!retHighest || computed !== value);
    } else if (retHighest) {
      setLow = computed <= value;
    } else {
      setLow = computed < value;
    }

    if (setLow) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return Math.min(high, 4294967295);
}

function sortedIndex(array, value) {
  return baseSortedIndex(array, value);
}

// --- debounce ---
function debounce(func, wait, options) {
  let lastArgs,
    lastThis,
    maxWait,
    result,
    timerId,
    lastCallTime;

  let lastInvokeTime = 0;
  let leading = false;
  let maxing = false;
  let trailing = true;

  if (typeof func !== 'function') {
    throw new TypeError('Expected a function');
  }

  wait = +wait || 0;
  if (isObject(options)) {
    leading = !!options.leading;
    maxing = 'maxWait' in options;
    maxWait = maxing ? Math.max(+options.maxWait || 0, wait) : maxWait;
    trailing = 'trailing' in options ? !!options.trailing : trailing;
  }

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function leadingEdge(time) {
    lastInvokeTime = time;
    timerId = setTimeout(timerExpired, wait);
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;

    return maxing
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxing && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired() {
    const time = now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timerId = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timerId = undefined;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel() {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timerId = undefined;
  }

  function flush() {
    return timerId === undefined ? result : trailingEdge(now());
  }

  function debounced(...args) {
    const time = now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxing) {
        clearTimeout(timerId);
        timerId = setTimeout(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }

    if (timerId === undefined) {
      timerId = setTimeout(timerExpired, wait);
    }
    return result;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  return debounced;
}

// --- Exports ---
export { debounce, sortedIndex };
export default debounce;
