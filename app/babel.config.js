const fs = require("node:fs");
const path = require("node:path");

function loadDotEnv(file) {
  const values = {};
  if (!fs.existsSync(file)) {
    return values;
  }
  for (const line of fs.readFileSync(file, "utf8").split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const appEnv = loadDotEnv(path.join(__dirname, ".env"));

module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: [
    function inlineAppEnv() {
      return {
        visitor: {
          MemberExpression(nodePath) {
            const node = nodePath.node;
            if (
              node.object.type !== "MemberExpression" ||
              node.object.object.type !== "Identifier" ||
              node.object.object.name !== "process" ||
              node.object.property.type !== "Identifier" ||
              node.object.property.name !== "env" ||
              node.property.type !== "Identifier" ||
              !Object.prototype.hasOwnProperty.call(appEnv, node.property.name)
            ) {
              return;
            }
            nodePath.replaceWith({ type: "StringLiteral", value: appEnv[node.property.name] });
          },
        },
      };
    },
  ],
};
