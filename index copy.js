
let mrls = require('message-relay-services')  // will export a chain from the message-relay-services to applications




module.exports.MessageRelayer = mrls.ClientMessageRelay
module.exports.ServeMessageRelay = mrls.ServerMessageRelay
module.exports.ServeMessageEndpoint = mrls.ServerMessageEndpoint
//
module.exports.PathHandler = mrls.PathHandler
module.exports.PeerPublishingHandler = mrls.PeerPublishingHandler
module.exports.path_hanlder_classes = mrls.path_hanlder_classes
module.exports.MultiRelayClient = mrls.MultiRelayClient
module.exports.MultiPathRelayClient = mrls.MultiPathRelayClient
//
module.exports.RelayCommunicator = mrls.RelayCommunicator
module.exports.EndpointCommunicator = mrls.EndpointCommunicator
module.exports.MessengerCommunicator = mrls.MessengerCommunicator
module.exports.JSONMessageQueue = mrls.JSONMessageQueue


//
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//
module.exports.ServerWithIPC = mrls.ServerWithIPC
module.exports.IPCClient = mrls.IPCClient
module.exports.IPCChildClient = mrls.IPCChildClient
module.exports.ParentIPCMessenger = mrls.ParentIPCMessenger

module.exports.ServerWithIPCommunicator = mrls.ServerWithIPCommunicator
module.exports.IPCClientCommunicator = mrls.IPCClientCommunicator
module.exports.IPCChildClientCommunicator = mrls.IPCChildClientCommunicator

module.exports.JsonMessageHandlerRelay = mrls.JsonMessageHandlerRelay
module.exports.EndpointReplier = mrls.EndpointReplier

