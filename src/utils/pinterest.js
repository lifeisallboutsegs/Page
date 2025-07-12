import axios from 'axios';

const BASE_URL = 'https://www.pinterest.com';

class PinterestSearcher {
    constructor() {
        this.headers = {
            'accept': 'application/json, text/javascript, */*, q=0.01',
            'accept-language': 'en-US,en;q=0.9,bn;q=0.8',
            'priority': 'u=1, i',
            'screen-dpr': '1',
            'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
            'sec-ch-ua-full-version-list': '"Not)A;Brand";v="8.0.0.0", "Chromium";v="138.0.7204.101", "Google Chrome";v="138.0.7204.101"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-model': '""',
            'sec-ch-ua-platform': '"Windows"',
            'sec-ch-ua-platform-version': '"19.0.0"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'x-app-version': 'a349e61',
            'x-pinterest-appstate': 'active',
            'x-pinterest-pws-handler': 'www/search/[scope].js',
            'x-requested-with': 'XMLHttpRequest',
            'Referer': `${BASE_URL}/`,
            'cookie': 'csrftoken=3a4ccbd244d593c5545ca78e3ddddaae; _pinterest_sess=TWc9PSY4c09QdVRZYW92L0FFTC9xc2ZTVk9KZTlWSnprZ1Z6Y040T2lTUWdKTXVFNTBjeDlHZU9DaFpSc2ltcThTM2Z0bzloTXNSZHB0NzZDWWhIb2NPR1MyWWgrWHJmYy8ydzJ2b29IRzNybldYVT0mVGQ0cG1wekhDWXFYSmd4VXA1MWQvdnFPaHNvPQ==; _auth=0; _routing_id="021d2fcf-0011-4976-8d7c-2355a071f033"; sessionFunnelEventLogged=1',
        };
    }

    _getInitialSearchOptions(query) {
        const sourceUrl = `/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;
        const data = {
            options: {
                query,
                scope: 'pins',
                rs: 'typed',
                source_url: sourceUrl,
                applied_unified_filters: null,
                appliedProductFilters: "---",
                article: null,
                auto_correction_disabled: false,
                corpus: null,
                customized_rerank_type: null,
                domains: null,
                filters: null,
                journey_depth: null,
                page_size: null,
                price_max: null,
                price_min: null,
                query_pin_sigs: null,
                redux_normalize_feed: true,
                request_params: null,
                selected_one_bar_modules: null,
                seoDrawerEnabled: false,
                source_id: null,
                source_module_id: null,
                top_pin_id: null,
                top_pin_ids: null,
            },
            context: {},
        };
        return { sourceUrl, data };
    }

    _getPaginationOptions(query, bookmark) {
        const sourceUrl = `/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;
        const data = {
            options: {
                query,
                scope: 'pins',
                rs: 'typed',
                bookmarks: [bookmark],
                source_url: sourceUrl,
                applied_unified_filters: null,
                appliedProductFilters: "---",
                article: null,
                auto_correction_disabled: false,
                corpus: null,
                customized_rerank_type: null,
                domains: null,
                filters: null,
                journey_depth: null,
                page_size: null,
                price_max: null,
                price_min: null,
                query_pin_sigs: null,
                redux_normalize_feed: true,
                request_params: null,
                selected_one_bar_modules: null,
                seoDrawerEnabled: false,
                source_id: null,
                source_module_id: null,
                top_pin_id: null,
                top_pin_ids: null,
            },
            context: {},
        };
        return { sourceUrl, data };
    }

    async search(query) {
        if (!query) {
            throw new Error('Query is required');
        }

        const { sourceUrl, data } = this._getInitialSearchOptions(query);
        const url = `${BASE_URL}/resource/BaseSearchResource/get/?source_url=${encodeURIComponent(sourceUrl)}&data=${encodeURIComponent(JSON.stringify(data))}&_=${Date.now()}`;

        const requestHeaders = {
            ...this.headers,
            'x-pinterest-source-url': sourceUrl,
        };

        try {
            const response = await axios.get(url, { headers: requestHeaders });
            return response.data;
        } catch (error) {
            console.error('Pinterest search failed:', error.response ? error.response.data : error.message);
            throw new Error('Failed to fetch data from Pinterest.');
        }
    }

    async getNextPage(query, bookmark) {
        if (!query || !bookmark) {
            throw new Error('Query and bookmark are required');
        }

        const { sourceUrl, data } = this._getPaginationOptions(query, bookmark);
        const url = `${BASE_URL}/resource/BaseSearchResource/get/`;
        
        const postData = `source_url=${encodeURIComponent(sourceUrl)}&data=${encodeURIComponent(JSON.stringify(data))}`;
        
        const postHeaders = {
            ...this.headers,
            'content-type': 'application/x-www-form-urlencoded',
            'x-csrftoken': this.headers.cookie.split(';').find(c => c.trim().startsWith('csrftoken=')).split('=')[1],
            'x-pinterest-source-url': sourceUrl,
        };

        try {
            const response = await axios.post(url, postData, { headers: postHeaders });
            return response.data;
        } catch (error) {
            console.error('Pinterest pagination failed:', error.response ? error.response.data : error.message);
            throw new Error('Failed to fetch next page from Pinterest.');
        }
    }
}

export default new PinterestSearcher(); 