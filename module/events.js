// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';



// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
const DEFAULT_MAX_LISTENERS = 10;
let g_max_listeners = DEFAULT_MAX_LISTENERS


let R = typeof Reflect === 'object' ? Reflect : null
let ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

let ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

let NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}


function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}


function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  let state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  let wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

function unwrapListeners(arr) {
  let ret = new Array(arr.length);
  for (let i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}


// ---- ---- ---- ---- ---- ----

export class EventEmitter {

  constructor() {
    this._events = {};
    this._eventsCount = 0;
    this._maxListeners = false;


    this.init()
  }


  get defaultMaxListeners() {
    return g_max_listeners;
  }

  set defaultMaxListeners(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    g_max_listeners = arg;
  }

  setMaxListeners(n) {
    if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
      throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
    }
    this._maxListeners = n;
  }

  getMaxListeners() {
    if ( typeof  this._maxListeners !== 'number' ) {
      return g_max_listeners
    }
    return this._maxListeners
  }


  init() {

    if (this._events === undefined || this._events === Object.getPrototypeOf(this)._events) {
      this._events = Object.create(null);
      this._eventsCount = 0;
    }
  
    this._maxListeners = this._maxListeners || undefined;
  }


  emit(type) {
    //
    let args = [];
    for (let i = 1; i < arguments.length; i++) args.push(arguments[i]);
    ///

    let event_map = this._events;
    //
    let doError = (type === 'error');

    if ( (event_map === undefined)  && !doError ) return false
  
    if (event_map !== undefined) {
      if (doError && (event_map.error === undefined)) {
        let er;
        if ( args.length > 0 ) er = args[0];
        if (er instanceof Error) {
          // Note: The comments on the `throw` lines are intentional, they show
          // up in Node's output if this results in an unhandled exception.
          throw er; // Unhandled 'error' event
        }
        // At least give some kind of context to the user
        let err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
        err.context = er;
        throw err; // Unhandled 'error' event  
      }
    }
  
    let handler = event_map[type];
    //
    if  (handler === undefined )  return false;
  
    if (typeof handler === 'function') {
      ReflectApply(handler, this, args);
    } else {
      let len = handler.length;
      let listeners =  [].concat(handler)
      for ( let i = 0; i < len; ++i )
        ReflectApply(listeners[i], this, args);
    }
  
    return true;
  }


  // #addListener
  #addListener(target, type, listener, prepend) {
    let m;
    let events;
    let existing;
  
    checkListener(listener);
  
    events = target._events;
    if ( events === undefined ) {
      events = target._events = {}
      target._eventsCount = 0;
    } else {
      // To avoid recursion in the case that type === "newListener"! Before
      // adding it to the listeners, first emit "newListener".
      if ( events.newListener !== undefined ) {
        target.emit('newListener', type,
                    listener.listener ? listener.listener : listener);
  
        // Re-assign `events` because a newListener handler could have caused the
        // this._events to be assigned to a new object
        events = target._events;
      }
      existing = events[type];
    }
  
    if ( existing === undefined ) {
      // Optimize the case of one listener. Don't need the extra array object.
      existing = events[type] = listener;
      ++target._eventsCount;
    } else {
      if (typeof existing === 'function') {  // was a single element
        // Adding the second element, need to change to array.
        existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];  // array of two
        // If we've already got an array, just append.
      } else if (prepend) { // else ops on array
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
  
      // Check for listener leak
      m = target.getMaxListeners()
      if ( (m > 0) && (existing.length > m )&& !existing.warned ) {
        existing.warned = true;
        // No error code for this since it is a Warning
        // eslint-disable-next-line no-restricted-syntax
        let w = new Error('Possible EventEmitter memory leak detected. ' +
                            existing.length + ' ' + String(type) + ' listeners ' +
                            'added. Use emitter.setMaxListeners() to ' +
                            'increase limit');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        ProcessEmitWarning(w);
      }
    }
  
    return target;
  }


  removeListener(type, listener) {
    let list, events, position, i, originalListener;

    checkListener(listener);

    events = this._events;
    if (events === undefined) return this;

    list = events[type];
    if (list === undefined) return this;

    if ( (list === listener) || (list.listener === listener) ) {  // SINGLE LISTENER
      if (--this._eventsCount === 0)
        this._events = {};
      else {
        delete events[type];
        if (events.removeListener) {
          this.emit('removeListener', type, list.listener || listener);
        }
      }
    } else if (typeof list !== 'function') {
      position = -1;

      // index of listener
      for (i = list.length - 1; i >= 0; i--) {
        if ( list[i] === listener || list[i].listener === listener ) {
          originalListener = list[i].listener;
          position = i;
          break;
        }
      }

      // not found
      if (position < 0) return this;

      if (position === 0)
        list.shift();
      else {
        list.splice(position,1)
      }

      // save some memory
      if ( list.length === 1 )  events[type] = list[0];

      if ( events.removeListener !== undefined ) {  // key for remove
        this.emit('removeListener', type, originalListener || listener);
      }
    }

    return this;
  }



  removeAllListeners(type) {
    let listeners, events, i;

    events = this._events;
    if ( events === undefined ) return this;

    // not listening for removeListener, no need to emit
    if ( events.removeListener === undefined ) {
      if (arguments.length === 0) {
        this._events = {};
        this._eventsCount = 0;
      } else if (events[type] !== undefined) {
        if (--this._eventsCount === 0)
          this._events = {};
        else
          delete events[type];
      }
      return this;
    }

    // emit removeListener for all listeners on all events
    if (arguments.length === 0) {

      for ( let key in events ) {
        if (key === 'removeListener') continue;
        this.removeAllListeners(key);
      }
      this.removeAllListeners('removeListener');
      this._events = {};
      this._eventsCount = 0;
      return this;
    }

    listeners = events[type];

    if (typeof listeners === 'function') {
      this.removeListener(type, listeners);
    } else if (listeners !== undefined) {
      // LIFO order
      for (i = listeners.length - 1; i >= 0; i--) {
        this.removeListener(type, listeners[i]);
      }
    }

    return this;
  }


  // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

  // synonyms
  addListener = function addListener(type, listener) {
    return this.#addListener(this, type, listener, false);
  }

  prependListener(type, listener) {
    return this.#addListener(this, type, listener, true);
  }


  once(type, listener) {
    checkListener(listener);
    this.on(type, _onceWrap(this, type, listener));
    return this;
  };
  
  prependOnceListener(type, listener) {
    checkListener(listener);
    this.prependListener(type, _onceWrap(this, type, listener));
    return this;
  };
  
  on(type, listener) {
    return this.#addListener(this, type, listener, false);
  }

  off(type, listener) {
    return this.removeListener(type, listener)
  }



  // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

  listenerCount(type) {
    let events = this._events;
    if ( events !== undefined ) {
      let evlistener = events[type];
      if ( typeof evlistener === 'function' ) {
        return 1;
      } else if ( evlistener !== undefined ) {
        return evlistener.length;
      }
    }
    return 0;
  }
  
  eventNames() {
    return (this._eventsCount > 0) ? ReflectOwnKeys(this._events) : [];
  }


  #listeners(target, type, unwrap) {
    let events = target._events;
  
    if (events === undefined)
      return [];
  
    let evlistener = events[type];
    if (evlistener === undefined)
      return [];
  
    if (typeof evlistener === 'function')
      return unwrap ? [evlistener.listener || evlistener] : [evlistener];
  
    return unwrap ?
      unwrapListeners(evlistener) : [].concat(evlistener);
  }
  
  listeners(type) {
    return this.#listeners(this, type, true);
  }
  
  rawListeners(type) {
    return this.#listeners(this, type, false);
  }
  
}


export function listenerCount(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

