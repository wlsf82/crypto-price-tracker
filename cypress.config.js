const { defineConfig } = require("cypress");

module.exports = defineConfig({
  projectId: "7x6pkm",
  e2e: {},
  retries: {
    runMode: 2,
    openMode: 0,
  },
});
