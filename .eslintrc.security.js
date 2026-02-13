module.exports = {
    extends: ["eslint:recommended", "plugin:security/recommended"],
    plugins: ["security"],
    rules: {
        "security/detect-object-injection": "error",
        "security/detect-eval-with-expression": "error",
        "security/detect-non-literal-regexp": "error",
        "security/detect-possible-timing-attacks": "error"
    }
};
