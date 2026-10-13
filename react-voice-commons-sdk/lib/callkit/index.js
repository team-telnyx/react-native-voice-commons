'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.useCallKitCoordinator =
  exports.useCallKit =
  exports.callKitCoordinator =
  exports.CallEndReason =
  exports.CallKit =
    void 0;
var callkit_1 = require('./callkit');
Object.defineProperty(exports, 'CallKit', {
  enumerable: true,
  get: function () {
    return __importDefault(callkit_1).default;
  },
});
Object.defineProperty(exports, 'CallEndReason', {
  enumerable: true,
  get: function () {
    return callkit_1.CallEndReason;
  },
});
var callkit_coordinator_1 = require('./callkit-coordinator');
Object.defineProperty(exports, 'callKitCoordinator', {
  enumerable: true,
  get: function () {
    return __importDefault(callkit_coordinator_1).default;
  },
});
var use_callkit_1 = require('./use-callkit');
Object.defineProperty(exports, 'useCallKit', {
  enumerable: true,
  get: function () {
    return use_callkit_1.useCallKit;
  },
});
var use_callkit_coordinator_1 = require('../hooks/use-callkit-coordinator');
Object.defineProperty(exports, 'useCallKitCoordinator', {
  enumerable: true,
  get: function () {
    return use_callkit_coordinator_1.useCallKitCoordinator;
  },
});
