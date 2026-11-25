# Sum up 25 November's world news in one image

[![news-image-20261125](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/Nghyuu/news-image-20261125-entry/rank.svg)](https://make.fun/bounty/news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/Nghyuu/news-image-20261125-entry/reward.svg)](https://make.fun/bounty/news-image-20261125)

One 1024x1024 image summing up the world news of Wednesday 25 November 2026:
Shenzhou-24 launches with the first Pakistani astronaut to Tiangong, a US jury
convicts Huawei on 10 of 12 counts, Putin warns of retaliation over Ukrainian
strikes on Russian oil refineries, an Israeli strike kills a Hamas security
chief in Gaza, 175 migrants go missing at sea off Senegal, a Turkish military
helicopter crash kills five, Australia signs a security pact with Solomon
Islands, and Australia apologises to LGBTQ veterans.

`main.ts` draws the image itself in pure TypeScript (Node 22 stdlib only, no
network): a bitmap-font rasterizer and a hand-written PNG encoder. It runs
twice and writes byte-identical output.

Run: `MAKEFUN_OUTPUT_DIR=out node main.ts`
