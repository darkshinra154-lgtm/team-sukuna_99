import axios from 'axios';
import FormData from 'form-data';

async function uploadImage(buffer) {
    try {
        const form = new FormData();
        form.append('file', buffer, 'tmp.jpg');
        const res = await axios.post('https://telegra.ph/upload', form, {
            headers: form.getHeaders()
        });
        return 'https://telegra.ph' + res.data[0].src;
    } catch (e) {
        throw new Error('Failed to upload image: ' + e.message);
    }
}

export default uploadImage;