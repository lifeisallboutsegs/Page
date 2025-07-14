
import axios from 'axios';
import config from '../../config.js';

export async function fetchUserInfo(psid) {
    try {
        const fields = 'first_name,last_name,profile_pic,locale,timezone,gender';
        const url = `https://graph.facebook.com/v19.0/${psid}?fields=${fields}&access_token=${config.PAGE_ACCESS_TOKEN}`;
        console.log(url)
        const res = await axios.get(url);
        console.log(res)
        return res.data;
    } catch (err) {
        return null;
    }
} 