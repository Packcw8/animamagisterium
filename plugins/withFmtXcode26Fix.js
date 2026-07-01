const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const patchBlock = `
    # Animamagisterium: Xcode 26 / Apple clang 21 rejects fmt's consteval
    # format-string path. Patch fmt's generated pod headers after CocoaPods
    # installs them, then keep the fmt pod itself on C++17.
    fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      patched = content.gsub(/^#\\s*define FMT_USE_CONSTEVAL 1$/, '#  define FMT_USE_CONSTEVAL 0')
      if patched != content
        File.chmod(0644, fmt_base)
        File.write(fmt_base, patched)
      end
    end

    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'

      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        config.build_settings['GCC_C_LANGUAGE_STANDARD'] = 'gnu11'
      end
    end
`;

function patchPodfile(contents) {
  if (contents.includes("Animamagisterium: Xcode 26 / Apple clang 21")) {
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
