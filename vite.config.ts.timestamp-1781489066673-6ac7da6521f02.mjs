// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { writeFileSync } from "fs";
import { resolve } from "path";
var __vite_injected_original_dirname = "/home/project";
function buildVersionPlugin() {
  return {
    name: "build-version",
    buildStart() {
      const version = Date.now().toString(36);
      writeFileSync(
        resolve(__vite_injected_original_dirname, "public/build-version.json"),
        JSON.stringify({ v: version, t: Date.now() })
      );
    }
  };
}
var vite_config_default = defineConfig({
  plugins: [react(), buildVersionPlugin()],
  optimizeDeps: {
    exclude: ["lucide-react"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyB3cml0ZUZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xuXG5mdW5jdGlvbiBidWlsZFZlcnNpb25QbHVnaW4oKSB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2J1aWxkLXZlcnNpb24nLFxuICAgIGJ1aWxkU3RhcnQoKSB7XG4gICAgICBjb25zdCB2ZXJzaW9uID0gRGF0ZS5ub3coKS50b1N0cmluZygzNik7XG4gICAgICB3cml0ZUZpbGVTeW5jKFxuICAgICAgICByZXNvbHZlKF9fZGlybmFtZSwgJ3B1YmxpYy9idWlsZC12ZXJzaW9uLmpzb24nKSxcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoeyB2OiB2ZXJzaW9uLCB0OiBEYXRlLm5vdygpIH0pXG4gICAgICApO1xuICAgIH0sXG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBidWlsZFZlcnNpb25QbHVnaW4oKV0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxvQkFBb0I7QUFDdFAsT0FBTyxXQUFXO0FBQ2xCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZUFBZTtBQUh4QixJQUFNLG1DQUFtQztBQUt6QyxTQUFTLHFCQUFxQjtBQUM1QixTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixhQUFhO0FBQ1gsWUFBTSxVQUFVLEtBQUssSUFBSSxFQUFFLFNBQVMsRUFBRTtBQUN0QztBQUFBLFFBQ0UsUUFBUSxrQ0FBVywyQkFBMkI7QUFBQSxRQUM5QyxLQUFLLFVBQVUsRUFBRSxHQUFHLFNBQVMsR0FBRyxLQUFLLElBQUksRUFBRSxDQUFDO0FBQUEsTUFDOUM7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGO0FBRUEsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sR0FBRyxtQkFBbUIsQ0FBQztBQUFBLEVBQ3ZDLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxjQUFjO0FBQUEsRUFDMUI7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
