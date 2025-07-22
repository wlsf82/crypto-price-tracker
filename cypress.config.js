const { defineConfig } = require("cypress");

module.exports = defineConfig({
  projectId: "7x6pkm",
  e2e: {},
  retries: {
    runMode: 4,
    openMode: 0,
  },
});
