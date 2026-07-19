const Tesseract = require("tesseract.js");

async function extractText(imagePath) {

    try {

        const { data } = await Tesseract.recognize(

            imagePath,

            "eng",

            {

                logger: info => {

                    if (info.status) {
                        console.log(
                            `${info.status} ${Math.round((info.progress || 0) * 100)}%`
                        );
                    }

                },

                tessedit_pageseg_mode: 6,

                tessedit_ocr_engine_mode: 1,

                preserve_interword_spaces: 1

            }

        );

        // Clean OCR text
        let text = data.text || "";

        text = text
            .replace(/\r/g, "")
            .replace(/[ \t]+/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        console.log("========== OCR RESULT ==========");
        console.log("Confidence :", data.confidence);
        console.log(text);
        console.log("================================");

        return text;

    }

    catch (err) {

        console.log("OCR Error :", err);

        throw err;

    }

}

module.exports = extractText;