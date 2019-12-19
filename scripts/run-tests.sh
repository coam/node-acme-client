#!/bin/bash
#
# Run test suite locally using CircleCI CLI.
#
set -eu

JOBS=("$@")

CIRCLECI_CLI_URL="https://github.com/CircleCI-Public/circleci-cli/releases/download/v0.1.5830/circleci-cli_0.1.5830_linux_amd64.tar.gz"
CIRCLECI_CLI_SHASUM="40f0d5f4ee725d83864dc253c4fd17a34295e077e80d622a7e5253bfaf94612c"
CIRCLECI_CLI_PATH="/tmp/circleci-cli"
CIRCLECI_CLI_BIN="${CIRCLECI_CLI_PATH}/circleci"

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && cd .. && pwd )"
CONFIG_PATH="${PROJECT_DIR}/.circleci/.temp.yml"


# Run all jobs by default
if [[ ${#JOBS[@]} -eq 0 ]]; then
    JOBS=("v8" "v10" "v12")
fi

# Download CircleCI CLI
if [[ ! -f "${CIRCLECI_CLI_BIN}" ]]; then
    echo "[-] Downloading CircleCI cli"
    mkdir -p "${CIRCLECI_CLI_PATH}"
    wget -nv "${CIRCLECI_CLI_URL}" -O "${CIRCLECI_CLI_PATH}/circleci-cli.tar.gz"
    echo "${CIRCLECI_CLI_SHASUM} *${CIRCLECI_CLI_PATH}/circleci-cli.tar.gz" | sha256sum -c
    tar zxvf "${CIRCLECI_CLI_PATH}/circleci-cli.tar.gz" -C "${CIRCLECI_CLI_PATH}" --strip-components=1
fi

# Run test suite
echo "[-] Running test suite"
$CIRCLECI_CLI_BIN config process "${PROJECT_DIR}/.circleci/config.yml" > "${CONFIG_PATH}"
$CIRCLECI_CLI_BIN config validate -c "${CONFIG_PATH}"

for job in "${JOBS[@]}"; do
    echo "[-] Running job: ${job}"
    $CIRCLECI_CLI_BIN local execute -c "${CONFIG_PATH}" --job "${job}" --skip-checkout
    echo "[+] ${job} completed successfully"
done

# Clean up
if [[ -f "${CONFIG_PATH}" ]]; then
    rm "${CONFIG_PATH}"
fi

echo "[+] Test suite ran successfully!"
exit 0
