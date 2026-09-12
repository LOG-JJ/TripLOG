# Receipt OCR runtime

Pinned, locally served browser assets. None of these components sends receipt images to an OCR service.

| Component | Version | Source | License |
| --- | --- | --- | --- |
| Tesseract.js UMD / worker | 6.0.1 | https://registry.npmjs.org/tesseract.js/-/tesseract.js-6.0.1.tgz | Apache-2.0; TESSERACT-LICENSE.md and bundled dependency notices |
| Tesseract.js-core LSTM / SIMD-LSTM | 6.1.2 | https://registry.npmjs.org/tesseract.js-core/-/tesseract.js-core-6.1.2.tgz | Apache-2.0; core-6.1.2/LICENSE |
| Korean / English / Japanese traineddata | tessdata_fast 4.1.0 | https://github.com/tesseract-ocr/tessdata_fast/tree/4.1.0 | Apache-2.0; lang/LICENSE |
| heic2any browser HEIC decoder | 0.0.4 | https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js | MIT; HEIC2ANY-LICENSE.md |

The core directory contains the two LSTM variants used by `createWorker(language, 1)`. Legacy OCR is not enabled. Language files are compressed with gzip (mtime 0), without changing the upstream traineddata content. Check `SHA256SUMS.txt` when updating assets. Source maps are not deployed.
