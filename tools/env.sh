# Source this: GPU-enabled headless Chromium + Node 24
D=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
export PATH=$HOME/nodejs24/bin:$PATH
export LD_LIBRARY_PATH=$D/.chromelibs/only
export __EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/10_nvidia.json
export CHROME_GPU_ARGS="--use-angle=gl-egl --use-gl=angle --ozone-platform=headless --ignore-gpu-blocklist --disable-gpu-sandbox --enable-gpu-rasterization"
