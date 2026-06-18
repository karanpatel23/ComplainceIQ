# Git LFS Asset Audit
Git LFS is available in the Codex environment and was configured for binary assets in the rebuilt website. No PDFs, images, icons, fonts, catalogs, or downloadable assets were removed.
## Binary assets found in `02-new-rebuild`
| Path | Size | Over 50MB | Over 100MB | LFS tracked |
| --- | ---: | :---: | :---: | :---: |
| `02-new-rebuild/public/downloads/brass-nrv.pdf` | 115,825 bytes (0.110 MiB) | No | No | Yes |
| `02-new-rebuild/public/downloads/royal-engitech-catalog.pdf` | 997,532 bytes (0.951 MiB) | No | No | Yes |
| `02-new-rebuild/public/downloads/royal-engitech-iso-certificate-2024.pdf` | 140,187 bytes (0.134 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/aluminum-components-line.jpg` | 133,168 bytes (0.127 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/brand/dandb.jpg` | 9,196 bytes (0.009 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/brand/nsic.jpg` | 9,784 bytes (0.009 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/brand/royal-logo.png` | 5,530 bytes (0.005 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/brand/tuvlogo.gif` | 7,185 bytes (0.007 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/cast-components-line.jpg` | 113,438 bytes (0.108 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/catalog-cover.jpg` | 51,964 bytes (0.050 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/cnc-equipment-line.jpg` | 98,127 bytes (0.094 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/cnc-workshop.jpg` | 218,289 bytes (0.208 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/export-engineering.jpg` | 61,962 bytes (0.059 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/fabrication-machinery.jpg` | 27,060 bytes (0.026 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/facility/foundry-shop.jpg` | 124,879 bytes (0.119 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/foundry-capability.jpg` | 52,173 bytes (0.050 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/foundry-pouring.jpg` | 52,173 bytes (0.050 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/gears-pulleys-line.jpg` | 137,435 bytes (0.131 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/hero-cnc-vmc.jpg` | 218,289 bytes (0.208 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/industrial-components.jpg` | 113,438 bytes (0.108 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/non-ferrous-components-line.jpg` | 183,254 bytes (0.175 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/precision-components-line.jpg` | 137,674 bytes (0.131 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/precision-machining.jpg` | 137,674 bytes (0.131 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/product-1.jpg` | 11,827 bytes (0.011 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/product-100.jpg` | 66,020 bytes (0.063 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/product-124.png` | 49,635 bytes (0.047 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/product-130.jpg` | 12,877 bytes (0.012 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/product-20.jpg` | 60,928 bytes (0.058 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/product-60.jpg` | 14,180 bytes (0.014 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/products/aluminum-parts.jpg` | 60,928 bytes (0.058 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/products/brass-nrv.jpg` | 11,240 bytes (0.011 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/products/cast-iron-castings.jpg` | 66,020 bytes (0.063 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/products/cnc-turned-parts.jpg` | 11,827 bytes (0.011 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/products/gears-timing-pulleys.jpg` | 12,877 bytes (0.012 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/products/ground-shafts.jpg` | 48,589 bytes (0.046 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/products/non-ferrous-castings.jpg` | 59,982 bytes (0.057 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/products/sheet-metal-parts.jpg` | 9,783 bytes (0.009 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/quality-measurement-systems.jpg` | 61,962 bytes (0.059 MiB) | No | No | Yes |
| `02-new-rebuild/public/images/sheet-metal-components-line.jpg` | 150,070 bytes (0.143 MiB) | No | No | Yes |

## Size threshold summary
- Assets over 50MB: none.
- Assets over 100MB: none.

## Git LFS tracking rules
The `.gitattributes` file tracks rebuilt-site binary asset extensions with Git LFS while leaving source code and text files in normal Git.

## Local fallback commands
If Git LFS is not installed locally, run:

```bash
git lfs install
git lfs track "02-new-rebuild/**/*.pdf" "02-new-rebuild/**/*.png" "02-new-rebuild/**/*.jpg" "02-new-rebuild/**/*.jpeg" "02-new-rebuild/**/*.webp" "02-new-rebuild/**/*.gif" "02-new-rebuild/**/*.ico" "02-new-rebuild/**/*.svg" "02-new-rebuild/**/*.avif" "02-new-rebuild/**/*.woff" "02-new-rebuild/**/*.woff2" "02-new-rebuild/**/*.ttf" "02-new-rebuild/**/*.otf" "02-new-rebuild/**/*.mp4" "02-new-rebuild/**/*.mov" "02-new-rebuild/**/*.webm" "02-new-rebuild/**/*.zip"
git add .gitattributes
git add --renormalize 02-new-rebuild/public
git commit -m "Track rebuild binary assets with Git LFS"
git lfs ls-files
```
