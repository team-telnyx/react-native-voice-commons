'use strict';
/**
 * @telnyx/react-voice-commons-sdk
 *
 * A high-level, state-agnostic, drop-in module for the Telnyx React Native SDK.
 *
 * This library provides a simplified interface for integrating Telnyx WebRTC
 * capabilities into React Native applications. It handles session management,
 * call state transitions, push notification processing, and native call UI
 * integration.
 */
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __exportStar =
  (this && this.__exportStar) ||
  function (m, exports) {
    for (var p in m)
      if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p))
        __createBinding(exports, m, p);
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.useAppReadyNotifier =
  exports.createTokenConfig =
  exports.createCredentialConfig =
  exports.validateTokenConfig =
  exports.validateCredentialConfig =
  exports.validateConfig =
  exports.isTokenConfig =
  exports.isCredentialConfig =
  exports.CallStateHelpers =
  exports.isTelnyxCallState =
  exports.TelnyxCallState =
  exports.isTransitioning =
  exports.isConnected =
  exports.canMakeCalls =
  exports.isTelnyxConnectionState =
  exports.TelnyxConnectionState =
  exports.Call =
  exports.useTelnyxVoice =
  exports.useAppStateHandler =
  exports.TelnyxVoiceApp =
  exports.createBackgroundTelnyxVoipClient =
  exports.destroyTelnyxVoipClient =
  exports.createTelnyxVoipClient =
  exports.TelnyxVoipClient =
    void 0;
// Main client
var telnyx_voip_client_1 = require('./telnyx-voip-client');
Object.defineProperty(exports, 'TelnyxVoipClient', {
  enumerable: true,
  get: function () {
    return telnyx_voip_client_1.TelnyxVoipClient;
  },
});
Object.defineProperty(exports, 'createTelnyxVoipClient', {
  enumerable: true,
  get: function () {
    return telnyx_voip_client_1.createTelnyxVoipClient;
  },
});
Object.defineProperty(exports, 'destroyTelnyxVoipClient', {
  enumerable: true,
  get: function () {
    return telnyx_voip_client_1.destroyTelnyxVoipClient;
  },
});
Object.defineProperty(exports, 'createBackgroundTelnyxVoipClient', {
  enumerable: true,
  get: function () {
    return telnyx_voip_client_1.createBackgroundTelnyxVoipClient;
  },
});
// TelnyxVoiceApp component
var telnyx_voice_app_1 = require('./telnyx-voice-app');
Object.defineProperty(exports, 'TelnyxVoiceApp', {
  enumerable: true,
  get: function () {
    return telnyx_voice_app_1.TelnyxVoiceApp;
  },
});
// Hooks
var useAppStateHandler_1 = require('./hooks/useAppStateHandler');
Object.defineProperty(exports, 'useAppStateHandler', {
  enumerable: true,
  get: function () {
    return useAppStateHandler_1.useAppStateHandler;
  },
});
var TelnyxVoiceContext_1 = require('./context/TelnyxVoiceContext');
Object.defineProperty(exports, 'useTelnyxVoice', {
  enumerable: true,
  get: function () {
    return TelnyxVoiceContext_1.useTelnyxVoice;
  },
});
// Models
var call_1 = require('./models/call');
Object.defineProperty(exports, 'Call', {
  enumerable: true,
  get: function () {
    return call_1.Call;
  },
});
var connection_state_1 = require('./models/connection-state');
Object.defineProperty(exports, 'TelnyxConnectionState', {
  enumerable: true,
  get: function () {
    return connection_state_1.TelnyxConnectionState;
  },
});
Object.defineProperty(exports, 'isTelnyxConnectionState', {
  enumerable: true,
  get: function () {
    return connection_state_1.isTelnyxConnectionState;
  },
});
Object.defineProperty(exports, 'canMakeCalls', {
  enumerable: true,
  get: function () {
    return connection_state_1.canMakeCalls;
  },
});
Object.defineProperty(exports, 'isConnected', {
  enumerable: true,
  get: function () {
    return connection_state_1.isConnected;
  },
});
Object.defineProperty(exports, 'isTransitioning', {
  enumerable: true,
  get: function () {
    return connection_state_1.isTransitioning;
  },
});
var call_state_1 = require('./models/call-state');
Object.defineProperty(exports, 'TelnyxCallState', {
  enumerable: true,
  get: function () {
    return call_state_1.TelnyxCallState;
  },
});
Object.defineProperty(exports, 'isTelnyxCallState', {
  enumerable: true,
  get: function () {
    return call_state_1.isTelnyxCallState;
  },
});
Object.defineProperty(exports, 'CallStateHelpers', {
  enumerable: true,
  get: function () {
    return call_state_1.CallStateHelpers;
  },
});
var config_1 = require('./models/config');
Object.defineProperty(exports, 'isCredentialConfig', {
  enumerable: true,
  get: function () {
    return config_1.isCredentialConfig;
  },
});
Object.defineProperty(exports, 'isTokenConfig', {
  enumerable: true,
  get: function () {
    return config_1.isTokenConfig;
  },
});
Object.defineProperty(exports, 'validateConfig', {
  enumerable: true,
  get: function () {
    return config_1.validateConfig;
  },
});
Object.defineProperty(exports, 'validateCredentialConfig', {
  enumerable: true,
  get: function () {
    return config_1.validateCredentialConfig;
  },
});
Object.defineProperty(exports, 'validateTokenConfig', {
  enumerable: true,
  get: function () {
    return config_1.validateTokenConfig;
  },
});
Object.defineProperty(exports, 'createCredentialConfig', {
  enumerable: true,
  get: function () {
    return config_1.createCredentialConfig;
  },
});
Object.defineProperty(exports, 'createTokenConfig', {
  enumerable: true,
  get: function () {
    return config_1.createTokenConfig;
  },
});
// Export CallKit functionality
__exportStar(require('./callkit'), exports);
// Export hooks
var useAppReadyNotifier_1 = require('./hooks/useAppReadyNotifier');
Object.defineProperty(exports, 'useAppReadyNotifier', {
  enumerable: true,
  get: function () {
    return useAppReadyNotifier_1.useAppReadyNotifier;
  },
});
