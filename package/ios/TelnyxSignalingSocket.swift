import Foundation
import React

@objc(TelnyxSignalingSocket)
final class TelnyxSignalingSocket: RCTEventEmitter, URLSessionWebSocketDelegate {
  private final class Socket {
    let id: NSNumber
    let task: URLSessionWebSocketTask
    var resolve: RCTPromiseResolveBlock?
    var reject: RCTPromiseRejectBlock?
    var opened = false

    init(_ id: NSNumber, _ task: URLSessionWebSocketTask,
         _ resolve: @escaping RCTPromiseResolveBlock,
         _ reject: @escaping RCTPromiseRejectBlock) {
      self.id = id
      self.task = task
      self.resolve = resolve
      self.reject = reject
    }
  }

  private let queue = DispatchQueue(label: "com.telnyx.signaling.socket")
  private var session: URLSession?
  private var sockets: [Int: Socket] = [:]

  override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String]! {
    ["TelnyxSocketMessage", "TelnyxSocketError", "TelnyxSocketClose"]
  }

  @objc(connect:url:resolver:rejecter:)
  func connect(_ socketId: NSNumber, url: String,
               resolver resolve: @escaping RCTPromiseResolveBlock,
               rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let url = URL(string: url), url.scheme?.lowercased() == "wss" else {
      reject("invalid_url", "A valid wss:// signaling URL is required", nil)
      return
    }

    queue.async {
      if self.session == nil {
        self.session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
      }
      let task = self.session!.webSocketTask(with: url)
      self.sockets[socketId.intValue] = Socket(socketId, task, resolve, reject)
      task.resume()
    }
  }

  @objc(send:message:)
  func send(_ socketId: NSNumber, message: String) {
    queue.async {
      self.sockets[socketId.intValue]?.task.send(.string(message)) { error in
        if let error = error {
          self.emit("TelnyxSocketError", socketId, error.localizedDescription)
        }
      }
    }
  }

  @objc(close:)
  func close(_ socketId: NSNumber) {
    queue.async {
      guard let socket = self.sockets.removeValue(forKey: socketId.intValue) else { return }
      socket.task.cancel(with: .normalClosure, reason: nil)
      socket.reject?("websocket_closed", "Signaling socket closed before opening", nil)
      self.emit("TelnyxSocketClose", socketId)
    }
  }

  func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask,
                  didOpenWithProtocol protocol: String?) {
    queue.async {
      guard let socket = self.socket(for: webSocketTask) else { return }
      socket.opened = true
      socket.resolve?(nil)
      socket.resolve = nil
      socket.reject = nil
      self.receive(socket)
    }
  }

  func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask,
                  didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
    queue.async { self.finish(webSocketTask) }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask,
                  didCompleteWithError error: Error?) {
    guard let task = task as? URLSessionWebSocketTask else { return }
    queue.async {
      guard let socket = self.socket(for: task) else { return }
      if let error = error {
        if socket.opened {
          self.emit("TelnyxSocketError", socket.id, error.localizedDescription)
        } else {
          socket.reject?("websocket_connect_failed", error.localizedDescription, error)
          socket.reject = nil
        }
      }
      self.finish(task)
    }
  }

  private func receive(_ socket: Socket) {
    socket.task.receive { result in
      self.queue.async {
        guard self.sockets[socket.id.intValue] === socket else { return }
        switch result {
        case .success(.string(let message)):
          self.emit("TelnyxSocketMessage", socket.id, message)
          self.receive(socket)
        case .success(.data(let data)):
          self.emit("TelnyxSocketMessage", socket.id, String(decoding: data, as: UTF8.self))
          self.receive(socket)
        case .failure(let error):
          self.emit("TelnyxSocketError", socket.id, error.localizedDescription)
          self.finish(socket.task)
        @unknown default:
          self.finish(socket.task)
        }
      }
    }
  }

  private func socket(for task: URLSessionWebSocketTask) -> Socket? {
    sockets.values.first { $0.task === task }
  }

  private func finish(_ task: URLSessionWebSocketTask) {
    guard let socket = socket(for: task) else { return }
    sockets.removeValue(forKey: socket.id.intValue)
    socket.reject?("websocket_closed", "Signaling socket closed before opening", nil)
    emit("TelnyxSocketClose", socket.id)
  }

  private func emit(_ name: String, _ id: NSNumber, _ message: String? = nil) {
    var body: [String: Any] = ["socketId": id]
    if let message = message { body["message"] = message }
    DispatchQueue.main.async { self.sendEvent(withName: name, body: body) }
  }

  override func invalidate() {
    queue.sync {
      sockets.values.forEach { $0.task.cancel(with: .goingAway, reason: nil) }
      sockets.removeAll()
      session?.invalidateAndCancel()
      session = nil
    }
    super.invalidate()
  }
}
