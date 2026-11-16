#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' 2>/dev/null; then
  if [[ ! -x .tools/node/bin/node ]]; then
    command -v curl >/dev/null || { echo 'Install Node.js 22+ or curl, then run this script again.'; exit 1; }
    case "$(uname -s)-$(uname -m)" in
      Linux-aarch64|Linux-arm64) kithcore_platform=linux-arm64 ;;
      Linux-x86_64) kithcore_platform=linux-x64 ;;
      Darwin-arm64) kithcore_platform=darwin-arm64 ;;
      Darwin-x86_64) kithcore_platform=darwin-x64 ;;
      *) echo 'Install Node.js 22+ from https://nodejs.org, then run npm ci and npm start.'; exit 1 ;;
    esac
    kithcore_version=v24.22.2
    kithcore_archive="node-${kithcore_version}-${kithcore_platform}.tar.gz"
    mkdir -p .tools/node
    echo "Installing project-local Node.js ${kithcore_version} (${kithcore_platform})…"
    curl --fail --silent --show-error --location "https://nodejs.org/dist/${kithcore_version}/${kithcore_archive}" -o ".tools/${kithcore_archive}"
    curl --fail --silent --show-error --location "https://nodejs.org/dist/${kithcore_version}/SHASUMS256.txt" -o .tools/SHASUMS256.txt
    ember_expected=$(awk -v name="$kithcore_archive" '$2 == name { print $1 }' .tools/SHASUMS256.txt)
    if command -v sha256sum >/dev/null; then ember_actual=$(sha256sum ".tools/${kithcore_archive}" | awk '{print $1}');
    else ember_actual=$(shasum -a 256 ".tools/${kithcore_archive}" | awk '{print $1}'); fi
    [[ -n "$ember_expected" && "$ember_expected" == "$ember_actual" ]] || { echo 'Node.js download checksum failed.'; exit 1; }
    tar -xzf ".tools/${kithcore_archive}" -C .tools/node --strip-components=1
    rm ".tools/${kithcore_archive}"
  fi
  export PATH="$PWD/.tools/node/bin:$PATH"
fi
if ! node -e 'const fs=require("node:fs"),p=JSON.parse(fs.readFileSync("package.json","utf8"));process.exit(Object.entries(p.dependencies).every(([name,version])=>JSON.parse(fs.readFileSync("node_modules/"+name+"/package.json","utf8")).version===version)?0:1)' 2>/dev/null; then npm ci --omit=dev; fi
exec node tools/run.js "$@"
