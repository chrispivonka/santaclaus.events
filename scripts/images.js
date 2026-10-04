// Makes the AVIF and WebP versions of the site's photos from the original JPEGs in assets/img,
// plus a smaller 480px-wide copy of the portrait photos for phones. Run with `npm run images`
// after adding or replacing a photo, then commit the results.
import sharp from 'sharp';

const photos = [
    { name: 'cabin', widths: [480, 736] },
    { name: 'santa-and-elves', widths: [480, 736] },
    { name: 'letter-bg', widths: [null] },
];

for (const { name, widths } of photos) {
    const source = `assets/img/${name}.jpg`;
    const { width: full } = await sharp(source).metadata();
    for (const width of widths) {
        const suffix = width && width < full ? `-${width}` : '';
        const resized = () => sharp(source).resize(width && width < full ? { width } : undefined);
        const avif = await resized().avif({ quality: 50, effort: 9 }).toFile(`assets/img/${name}${suffix}.avif`);
        const webp = await resized().webp({ quality: 75, effort: 6 }).toFile(`assets/img/${name}${suffix}.webp`);
        console.log(`${name}${suffix}: avif ${(avif.size / 1024).toFixed(1)} KB, webp ${(webp.size / 1024).toFixed(1)} KB`);
    }
}
