/** @type {import('jest').Config} */
module.exports = {
  // 👉 make ts-jest transpile every *.ts / *.tsx file
  preset: "ts-jest",

  testEnvironment: "node", // fine for API / server code
  roots: ["<rootDir>"], // look everywhere under repo root
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  // Optional but recommended:
  collectCoverage: true,
};
