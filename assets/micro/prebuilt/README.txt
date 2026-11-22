Microcassette pre-built database
================================
albums.json lists the albums (artist, title, J-card image, side label images) that are filed in the microcassette
library automatically. Copy the image files (tribe-midjcard.png, tribe-midsidea.png, ...) into THIS folder.

* Albums whose images are not here yet are skipped, and picked up the next time the microcassette library is opened.
* Images are copied into the app's own art folder and saved in micro.db (jcard, label_a ... label_d).
* Anything you edit in the app is never overwritten: each image is only imported once.
* Album entries match by artist + title, so when you later open the real music for one of them, it uses this artwork.
