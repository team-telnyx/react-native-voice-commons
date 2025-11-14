"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTelnyxVoice = exports.TelnyxVoiceProvider = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const TelnyxVoiceContext = (0, react_1.createContext)(null);
const TelnyxVoiceProvider = ({ voipClient, children }) => {
    return ((0, jsx_runtime_1.jsx)(TelnyxVoiceContext.Provider, { value: { voipClient }, children: children }));
};
exports.TelnyxVoiceProvider = TelnyxVoiceProvider;
const useTelnyxVoice = () => {
    const context = (0, react_1.useContext)(TelnyxVoiceContext);
    if (!context) {
        throw new Error('useTelnyxVoice must be used within a TelnyxVoiceProvider');
    }
    return context;
};
exports.useTelnyxVoice = useTelnyxVoice;
