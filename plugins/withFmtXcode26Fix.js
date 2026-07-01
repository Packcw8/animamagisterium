const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const patchBlock = `
    # Animamagisterium: Xcode 26 can compile fmt with C++20 consteval paths
    # that fail under the React Native 0.79 pod setup. Keep fmt on C++17.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'

      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        config.build_settings['GCC_C_LANGUAGE_STANDARD'] = 'gnu11'
      end
    end
`;

function patchPodfile(contents) {
  if (contents.includes("Animamagisterium: Xcode 26 can compile fmt")) {
    return contents;
  }

  const postInstallPattern = /post_install do \|installer\|\n/;
  if (postInstallPattern.test(contents)) {
    return contents.replace(postInstallPattern, (match) => `${match}${patchBlock}`);
  }

  return `${contents.trimEnd()}

post_install do |installer|
${patchBlock}
end
`;
}

module.exports = function withFmtXcode26Fix(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      const current = fs.readFileSync(podfilePath, "utf8");
      const next = patchPodfile(current);

      if (next !== current) {
        fs.writeFileSync(podfilePath, next);
      }

      return config;
    },
  ]);
};

module.exports._patchPodfileForTest = patchPodfile;
