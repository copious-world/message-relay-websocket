// 

class JSONMessageQueue {

    constructor(decoder,encoder) {
        this.message_queue = [];
        this.last_message = '';
        this.current_message = {};
        //
        if ( (decoder === undefined) || (decoder === false) ) {
            this.message_decoder = this.default_decoder;
        } else if ( decoder !== this.decode_message ) {
            this.message_decoder = decoder;
        } else {
            this.message_decoder = this.default_decoder;
        }
        //
        if ( (encoder === undefined) || (encoder === false) ) {
            this.message_encoder = this.default_encoder;
        } else if ( encoder !== this.message_encoder ) {
            this.message_encoder = encoder;
        } else {
            this.message_encoder = this.default_encoder;
        }
    }
    
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    set_decoder(decoder) {
        this.message_decoder = decoder;
    }

    set_encoder(encoder) {
        this.message_encoder = encoder;
    }

    default_decoder(str) {
        try {
            let m_obj = JSON.parse(str);
            return m_obj
        } catch (e) {
            console.error(e);
        }
        return false
    }

    default_encoder(j_obj) {
        return JSON.stringify(j_obj)
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    //
    add_data(data) {
        this.last_message += data.toString();
    }

    add_object(m_obj) {
        this.message_queue.push(m_obj);
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    //
    message_complete() {
        let msg = this.last_message;
        this.last_message = "";
        //
        msg = msg.trim();
        //
        if ( !(msg.length) ) return
        //
        msg = msg.replace(/\}\s+\{/g,'}{');
        let raw_m_list = msg.split('}{');
        let rest = "";
        let n = raw_m_list.length;
        for ( let i = 0; i < n; i++ ) {
            rest = raw_m_list[i];
            let str = rest;
            if ( i < (n-1) ) str += '}';
            if ( i > 0 ) str = '{' + str;
            let m_obj = this.message_decoder(str);
            if ( m_obj ) {
                this.message_queue.push(m_obj);              /// enqueue
            } else {
                this.last_message = '{' + rest;
            }
        }
    }

    //
    dequeue() {
        this.current_message = this.message_queue.shift();
        return this.current_message
    }


    encode_message(message) {
        return this.message_encoder(message)
    }

    decode_message(message_str) {
        return this.message_decoder(message_str)
    }

}

// ResponseVector 
// class with no dependencies -- this keeps the response lambdas waiting for data back from a server
// does not address expiration.. does not provide optimization beyon javascript capability


const MAX_UNANSWERED_MESSAGES = 100;

class ResponseVector {

    constructor(conf) {
        this.max_unanswered =  conf ? conf.max_pending_messages || MAX_UNANSWERED_MESSAGES : MAX_UNANSWERED_MESSAGES;  
        this.setup_response_vector();
    }

    //
    // get_response_id
    //      looks for a free position in the waiting_for_response array.
    //      Elements in use always contain resolver functions for relaying responses to waiting callers (await ...)
    //      usually found within 'async' functions.
    //
    get_response_id() {
        let first_try = Math.floor(Math.random()*this.max_unanswered);
        let try_index = first_try;
        while ( try_index < this.max_unanswered ) {
            if ( this.waiting_for_response[try_index] === false ) {
                return(try_index)
            }
            try_index++;
        }
        try_index = 0;
        while ( try_index < first_try ) {
            if ( this.waiting_for_response[try_index] === false ) {
                return(try_index)
            }
            try_index++;
        }
        return(-1) // server might be down
    }

    setup_response_vector() {
        this.waiting_for_response = new Array(this.max_unanswered);
        this.waiting_for_response.fill(false,0,this.max_unanswered);
    }

    unlock_response_id(id) {
        this.waiting_for_response[id] = false;
    }

    lock_response_id(id,fn) {
        this.waiting_for_response[id] = fn;
    }
    
    get_response_resolver(id) {
        return this.waiting_for_response[id]
    }  

}

// Copyright Joyent, Inc. and other Node contributors.



// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
const DEFAULT_MAX_LISTENERS = 10;
let g_max_listeners = DEFAULT_MAX_LISTENERS;


let R = typeof Reflect === 'object' ? Reflect : null;
let ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  };

let ReflectOwnKeys;
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys;
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
};


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

class EventEmitter {

  constructor() {
    this._events = {};
    this._eventsCount = 0;
    this._maxListeners = false;


    this.init();
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
      let listeners =  [].concat(handler);
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
      events = target._events = {};
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
      m = target.getMaxListeners();
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
        list.splice(position,1);
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

// ---- ----



class CommunicatorAPI extends EventEmitter {
    //
    constructor() {
        super();
    }

    // ---- ---- ---- ---- ---- ---- ----
    async publish(topic,path,message) {
        if ( !(topic) || !(path) ) return false
        if ( !(message) ) return false
        message._ps_op = "pub";
        message.topic = topic;
        message._m_path = path;
        try {
            return await this.sendMessage(message)            
        } catch (e) {
            console.log(e);
            return false
        }
    }

    
    // ---- ---- ---- ---- ---- ---- ---- ----
    //
    async subscribe(topic,path,message,handler) {
        if ( !(topic) || !(path) ) return false
        if ( (typeof message === 'function') && (handler === undefined) ) {
            handler = message;
            message = {};
        } else if ( (typeof message === 'boolean')  && (typeof message === 'function') ) {
            message = {};
        } else if (handler === undefined ) {
            return false
        } 
        if ( handler !== undefined && (typeof handler === "function") ) {
            this.on(`update-${topic}-${path}`,handler);
            this.subcriptions[`update-${topic}-${path}`] = handler;
        }
        message._ps_op = "sub";
        message.topic = topic;
        message._m_path = path;
        try {
            return await this.sendMessage(message)            
        } catch (e) {
            console.log(e);
            return false
        }
    }

    // ---- ---- ---- ---- ---- ---- ----
    async unsubscribe(topic,path) {
        if ( !(topic) || !(path) ) return false
        let handler = this.subcriptions[`update-${topic}-${path}`];
        if ( handler ) {
            this.removeListener(`update-${topic}-${path}`,handler);
            delete this.subcriptions[`update-${topic}-${path}`];
        }
        let message = {
            "_ps_op" : "unsub",
            "topic" : topic
        };
        message._m_path = path;
        try {
            return await this.sendMessage(message)            
        } catch (e) {
            console.log(e);
            return false
        }
    }


    //
    send(message) {     // sometimes synonyms help
        if ( !(message) ) return false
        return this.sendMessage(message)
    }

    //      returns a promise
    send_on_path(message,path) {
        try {
            let msg = Object.assign({},message);
            msg['_m_path'] = path;
            return this.sendMessage(msg)
        } catch (e) {
            console.error(e);
            return false
        }
    }

    send_op_on_path(message,path,op) {
        if ( !(message) ) return false
        message._tx_op = op;
        return this.send_on_path(message,path)
    }

    get_on_path(message,path) {
        if ( !(message) ) return false
        message._tx_op = 'G';
        return this.send_on_path(message,path)
    }

    set_on_path(message,path) {
        if ( !(message) ) return false
        message._tx_op = 'S';
        return this.send_on_path(message,path)
    }

    mod_on_path(message,path) {
        if ( !(message) ) return false
        message._tx_op = 'M';
        return this.send_on_path(message,path)
    }

    del_on_path(message,path) {
        if ( !(message) ) return false
        message._tx_op = 'D';
        return this.send_on_path(message,path)
    }

    publication_on_path(message,path) {
        if ( !(message) ) return false
        message._tx_op = 'P';
        return this.send_on_path(message,path)
    }

    unpublish_on_path(message,path) {
        if ( !(message) ) return false
        message._tx_op = 'U';
        return this.send_on_path(message,path)
    }

}


class Communicator extends CommunicatorAPI  {

    constructor(conf,wrapper,skip_init) {
        //
        super();
        //
        this.subcriptions = {};
        if ( conf.JSONMessageQueueClass ) {
            let mqClass = require(conf.JSONMessageQueueClass);
            this.messages = new mqClass(false);
        } else {
            this.messages = new JSONMessageQueue(false);
        }
        //
        try {
            this.resp_vector = !(conf.response_vector) ? new ResponseVector(conf) : new (require(conf.response_vector));
        } catch (e) {
            this.resp_vector = new ResponseVector(conf);
        }
        //
        //
        this.writer = false;     // The writer is set by the descendant... perhaps tcp udp websocket, etc.
        this.event_wrapper = false;
        if ( wrapper ) {
             this.event_wrapper = wrapper;
        }
        //
        if ( !(skip_init) ) {
            this._init(conf);
        }
    }


    _init(conf) { 
        throw new Error("Descedant of class Messenger must implement _init.")
    }

    //
    _handle_unsolicited(message) {
        if ( message !== undefined ) {
            let topic = message.topic;
            let path = message._m_path;
            this.emit(`update-${topic}-${path}`,message);
        } 
    }
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    // INBOUND MESSAGE DATA
    // The inbound message handlers (responses and unsolicited on this client socket)
    client_add_data_and_react(data) {
        let mqueue = this.messages;
        mqueue.add_data(data);
        mqueue.message_complete();
        let message = undefined;
        while ( mqueue.message_queue.length ) {
            message = mqueue.dequeue();
            if ( message._response_id !== undefined ) {
                let resolver = this.resp_vector.get_response_resolver(message._response_id);
                if ( typeof resolver === "function" ) {
                    resolver(message);
                }
            } else {
                this._handle_unsolicited(message);
            }
        }
    }

    // OUTBOUND MESSAGE DATA
    _message_and_response(message,resolve,reject) {
        let id = this.resp_vector.get_response_id();
        if ( id < 0 ) {
            reject(new Error("send message max out... is server up?"));
        }
        message._response_id = id;   // overwrites this if sender copied a forwarded object...
        let message_handler = (msg) => { 
            this.resp_vector.unlock_response_id(id);
            resolve(msg); 
        };
        this.resp_vector.lock_response_id(id,message_handler);
        //
        // write message
        let flat_message = this.messages.encode_message(message);

        if ( this.writer ) {
            //
            let err_handler = (err) => {
                this.writer.removeListener('error',err_handler);
                reject(err);
            };
            this.writer.on('error',err_handler);
            try {
                this.writer.write(flat_message);            // write message here....
            } catch (e) {
                this.resp_vector.unlock_response_id(id);
                console.log(e);
            } finally {
                // might reserve this until the response is received
                this.writer.removeListener('error',err_handler);
            }
            //
        }
    }

    //
    // sendMessage
    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    //
    // This sends messages to IP endpoints. But, it may also write to a file if that has been setup through configuration 
    // with files_only. Another reason data may be place in files is that the socket may close or be broken in some way.
    //
    // If sending through on the sockets, this method will only ever add _response_id to the object being sent. 
    // This class expects the server to send _response_id back so that it can find callers without thunking too much. 
    // _response_id finds the requeting socket and relays the results back. 
    //
    // _response_id is specifically generated by _get_response_id(). _get_response_id returns an index for a space in 
    //  waiting_for_response array.
    //
    sendMessage(message) {   // secondary queuing is possible
        return new Promise((resolve, reject) => {
                this._message_and_response(message,resolve,reject);
        });
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


    // external event wrapper 
    wrap_event(wrapper_key) {
        if ( this.event_wrapper && this.event_wrapper.commission ) {
            this.event_wrapper.commission(wrapper_key);
        }
    }

    unwrap_event(wrapper_key) {
        if ( this.event_wrapper && this.event_wrapper.decommission  ) {
            this.event_wrapper.decommission(wrapper_key);
        }
    }

}

const DEFAULT_MAX_RECONNECT = 20;
const DEFAULT_RECONNECT_WAIT = 5;


class WSWriter extends EventEmitter {

    constructor(ws) {
        super();
        this.ws = ws;
    }

    //
    write(message) {
        try {
            this.ws.send(message);
        } catch(e) {
            console.log(e);
        }
    }

}

// use the browser WebSocket class

class MessageRelayer extends Communicator {
    //
    constructor(conf,wrapper) {
        super(conf,wrapper);
    }

    //
    _init(conf) {
        if ( conf === undefined ) {
            console.log("message relay client: cannot initialize -- no configuration");
            return;
        }
        this._init_members(conf);
        this._create_connection(conf);
    }

    
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    _init_members(conf) {

        this.port = conf ? conf.port || PORT : PORT;
        this.address = conf ? conf.address || HOST : HOST;
        this.options = conf.ws_options;
        this.ws_app_path = conf.ws_path ? console.ws_path : "";
        if ( this.ws_app_path[0] != '/' ) this.ws_app_path = '/' + this.ws_app_path;
        //
        //
        this.send_on_reconnect = conf ? conf.send_on_reconnect || false : false;
        //
        this.attempt_reconnect = false;
        this.reconnect_wait = DEFAULT_RECONNECT_WAIT;
        this.max_reconnect = DEFAULT_MAX_RECONNECT;
        this.reconnect_count = 0;
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    _create_connection(conf) {
        this.attempt_reconnect = (conf.attempt_reconnect !== undefined) ? conf.attempt_reconnect : false;
        if ( this.attempt_reconnect ) {
            this._configure_reconnect(conf);
        }
        this._connect();
        this._setup_connection_handlers(this,conf);
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    // CONNECTION
    _connect() {
        if ( this.options ) {
            this.ws = new WebSocket(`ws://${this.address}:${this.port}${this.ws_app_path}`,this.options);
        } else {
            this.ws = new WebSocket(`ws://${this.address}:${this.port}${this.ws_app_path}`);
        }
        this.ws.onopen = () => {
            this._connection_handler();
        };
    }

    // // // // // // 

    _connection_handler() {
        this.writer = new WSWriter(this.ws);
        this.wrap_event(this.address);
        this.reconnect_count = 0;
        console.log(`Client connected to: ${this.address} :  ${this.port}`);
        this.emit('client-ready',this.address,this.port);
    }

    // SET UP CONNECTION AND HANDLERS  on('close'...) on('data'...) on('error'...)
    // _setup_connection_handlers
    //
    _setup_connection_handlers(client,conf) {
        //
        // 1. data
        client.ws.onmessage = ((com) => { return (ev) => {   // ws returns an event
            let data = ev.data;
            com.client_add_data_and_react(data);
        }})(this);
        //
        //  2. close
        client.ws.onclose = ((com) => { return () => {
            this.unwrap_event(this.address);
            console.log('Client closed');
            if ( client.attempt_reconnect ) {
                client._attempt_reconnect(conf);
            }
            com.closeAll();
        }})(this);
        //
        // 3. error
        client.ws.onerror = (err) => {
            this.unwrap_event(this.address);
            console.log(err);
        };
        //
    }


    closeAll() {
    }


}

let WSMessageRelayer = MessageRelayer;

export { WSMessageRelayer };
