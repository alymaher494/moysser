const security = require("eslint-plugin-security");

module.exports = [
    security.configs.recommended,
    {
        rules: {
            "security/detect-object-injection": "error",
            "security/detect-eval-with-expression": "error",
            "security/detect-non-literal-regexp": "error",
            "security/detect-possible-timing-attacks": "error"
        }
    }
];
