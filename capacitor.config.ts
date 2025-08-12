import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.riozee.yomihelper",
  appName: "YomiHelper",
  webDir: "dist",
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1a1a1a",
      overlaysWebView: false,
    },
  },
};

export default config;

