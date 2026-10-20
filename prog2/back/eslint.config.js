const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/**", "imagenes/**"] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: "commonjs", globals: globals.node },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-useless-assignment": "warn",
    },
  },
];
