import * as userDb from '../src/utils/userDb.js';
import moment from 'moment-timezone';
import logger from '../logger.js';
import cityTimezones from 'city-timezones';
import config from '../config.js';
export default {
    name: 'timezone',
    description: 'Set your timezone for personalized moment messages.',
    usage: '{PREFIX}timezone <timezone_name_or_gmt_offset>',
    examples: [
        '{PREFIX}timezone Asia/Dhaka',
        '{PREFIX}timezone Dhaka',
        '{PREFIX}timezone London',
        '{PREFIX}timezone New York',
        '{PREFIX}timezone Europe/Berlin',
        '{PREFIX}timezone GMT+6',
        '{PREFIX}timezone PST'
    ],
    onCall: async function ({ args, senderId, reply, user }) {
        const userPrefix = (user && user.custom && user.custom.prefix) ? user.custom.prefix : config.commandPrefix;
        const inputRaw = args.join(' ') || null;
        if (!inputRaw) {
            await reply(`Please provide a timezone. Examples: ${userPrefix}timezone Asia/Dhaka, ${userPrefix}timezone London, ${userPrefix}timezone GMT+6, or ${userPrefix}timezone PST.`);
            return;
        }
        const inputLower = inputRaw.toLowerCase();
        let newTimezone = null;
        let isGMT = false;

        // 1. Try to parse GMT/UTC offset (e.g., GMT+6, UTC-5)
        const gmtMatch = inputRaw.match(/^(GMT|UTC)([+-])(\d{1,2})$/i);
        if (gmtMatch) {
            const sign = gmtMatch[2] === '+' ? 1 : -1;
            const offset = parseInt(gmtMatch[3], 10);
            const foundTimezone = moment.tz.names().find(name => {
                try {
                    return moment().tz(name).utcOffset() / 60 === (sign * offset);
                } catch (e) {
                    return false;
                }
            });
            if (foundTimezone) {
                newTimezone = foundTimezone;
                isGMT = true;
            }
        }

        // 2. Try to map common city/country names or abbreviations to IANA timezones
        const commonMappings = {
            'dhaka': 'Asia/Dhaka',
            'london': 'Europe/London',
            'newyork': 'America/New_York',
            'paris': 'Europe/Paris',
            'tokyo': 'Asia/Tokyo',
            'sydney': 'Australia/Sydney',
            'losangeles': 'America/Los_Angeles',
            'chicago': 'America/Chicago',
            'denver': 'America/Denver',
            'dubai': 'Asia/Dubai',
            'kolkata': 'Asia/Kolkata',
            'india': 'Asia/Kolkata',
            'bangladesh': 'Asia/Dhaka',
            'united kingdom': 'Europe/London',
            'united states': 'America/New_York',
            'canada': 'America/Toronto',
            'australia': 'Australia/Sydney',
            'germany': 'Europe/Berlin',
            'france': 'Europe/Paris',
            'japan': 'Asia/Tokyo',
            'uae': 'Asia/Dubai',
            'china': 'Asia/Shanghai',
            'russia': 'Europe/Moscow',
            'brazil': 'America/Sao_Paulo',
            'mexico': 'America/Mexico_City',
            'south africa': 'Africa/Johannesburg',
            'egypt': 'Africa/Cairo',
            'greece': 'Europe/Athens',
            'spain': 'Europe/Madrid',
            'italy': 'Europe/Rome',
            'netherlands': 'Europe/Amsterdam',
            'sweden': 'Europe/Stockholm',
            'norway': 'Europe/Oslo',
            'denmark': 'Europe/Copenhagen',
            'finland': 'Europe/Helsinki',
            'ireland': 'Europe/Dublin',
            'new zealand': 'Pacific/Auckland',
            'argentina': 'America/Argentina/Buenos_Aires',
            'chile': 'America/Santiago',
            'peru': 'America/Lima',
            'colombia': 'America/Bogota',
            'venezuela': 'America/Caracas',
            'pakistan': 'Asia/Karachi',
            'indonesia': 'Asia/Jakarta',
            'thailand': 'Asia/Bangkok',
            'vietnam': 'Asia/Ho_Chi_Minh',
            'philippines': 'Asia/Manila',
            'malaysia': 'Asia/Kuala_Lumpur',
            'singapore': 'Asia/Singapore',
            'saudi arabia': 'Asia/Riyadh',
            'turkey': 'Europe/Istanbul',
            'iran': 'Asia/Tehran',
            'nigeria': 'Africa/Lagos',
            'kenya': 'Africa/Nairobi',
            'south korea': 'Asia/Seoul',
            'china': 'Asia/Shanghai',
            'hong kong': 'Asia/Hong_Kong',
            'taiwan': 'Asia/Taipei',
            'south africa': 'Africa/Johannesburg',
            'gulf standard time': 'Asia/Dubai',
            'central european time': 'Europe/Paris',
            'eastern european time': 'Europe/Athens',
            'australian eastern standard time': 'Australia/Sydney',
            'pst': 'America/Los_Angeles',
            'est': 'America/New_York',
            'cst': 'America/Chicago',
            'mst': 'America/Denver',
            'ist': 'Asia/Kolkata',
            'bdt': 'Asia/Dhaka',
            'gst': 'Asia/Dubai',
            'cet': 'Europe/Paris',
            'eet': 'Europe/Athens',
            'aest': 'Australia/Sydney'
        };

        // Add more common cities explicitly
        const additionalCityMappings = {
            'berlin': 'Europe/Berlin',
            'rome': 'Europe/Rome',
            'madrid': 'Europe/Madrid',
            'amsterdam': 'Europe/Amsterdam',
            'stockholm': 'Europe/Stockholm',
            'oslo': 'Europe/Oslo',
            'copenhagen': 'Europe/Copenhagen',
            'helsinki': 'Europe/Helsinki',
            'dublin': 'Europe/Dublin',
            'auckland': 'Pacific/Auckland',
            'buenosaires': 'America/Argentina/Buenos_Aires',
            'santiago': 'America/Santiago',
            'lima': 'America/Lima',
            'bogota': 'America/Bogota',
            'caracas': 'America/Caracas',
            'karachi': 'Asia/Karachi',
            'jakarta': 'Asia/Jakarta',
            'bangkok': 'Asia/Bangkok',
            'hochiminh': 'Asia/Ho_Chi_Minh',
            'manila': 'Asia/Manila',
            'kualalumpur': 'Asia/Kuala_Lumpur',
            'singapore': 'Asia/Singapore',
            'riyadh': 'Asia/Riyadh',
            'istanbul': 'Europe/Istanbul',
            'tehran': 'Asia/Tehran',
            'lagos': 'Africa/Lagos',
            'nairobi': 'Africa/Nairobi',
            'seoul': 'Asia/Seoul',
            'shanghai': 'Asia/Shanghai',
            'hongkong': 'Asia/Hong_Kong',
            'taipei': 'Asia/Taipei',
            'johannesburg': 'Africa/Johannesburg',
            'cairo': 'Africa/Cairo',
            'moscow': 'Europe/Moscow',
            'saopaulo': 'America/Sao_Paulo',
            'mexicocity': 'America/Mexico_City',
        };

        // Merge additional city mappings with existing common mappings
        Object.assign(commonMappings, additionalCityMappings);

        if (!newTimezone && commonMappings[inputLower]) {
            newTimezone = commonMappings[inputLower];
        }

        // 3. Fuzzy search for IANA timezone names (case-insensitive)
        if (!newTimezone) {
            const ianaNames = moment.tz.names();
            const possibleMatches = ianaNames.filter(name => 
                name.toLowerCase().includes(inputLower) || 
                name.split(/[\/_]/).some(part => part.toLowerCase().includes(inputLower))
            );

            if (possibleMatches.length === 1) {
                newTimezone = possibleMatches[0];
            } else if (possibleMatches.length > 1 && possibleMatches.length <= 15) {
                await reply(`Did you mean one of these? Please use the exact name:
${possibleMatches.map(name => `- ${name}`).join('\n')}

Or provide a GMT/UTC offset (e.g., GMT+6).`);
                return;
            } else if (possibleMatches.length > 15) {
                await reply(`Your input '${inputRaw}' is too broad and matches too many timezones. Please be more specific (e.g., Asia/Dhaka, Europe/London, or a major city name). You can find a list here: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones`);
                return;
            }
        }

        // 5. Use city-timezones package for global city/country lookup if still not found
        if (!newTimezone) {
            const cityResults = cityTimezones.lookupViaCity(inputRaw);
            if (cityResults && cityResults.length > 0) {
                // Filter for unique timezones
                const uniqueZones = Array.from(new Set(cityResults.map(r => r.timezone)));
                if (uniqueZones.length === 1) {
                    newTimezone = uniqueZones[0];
                } else if (uniqueZones.length > 1 && uniqueZones.length <= 15) {
                    await reply(`Multiple timezones found for '${inputRaw}'. Please specify one of these:
${uniqueZones.map(z => `- ${z}`).join('\n')}`);
                    return;
                } else if (uniqueZones.length > 15) {
                    await reply(`Your input '${inputRaw}' matches too many timezones. Please be more specific (e.g., include the country or region).`);
                    return;
                }
            }
        }

        // 4. Final check if it's a recognized IANA timezone name (case-sensitive after all processing)
        if (!newTimezone || !moment.tz.names().includes(newTimezone)) {
            await reply(`I couldn't recognize '${inputRaw}' as a valid timezone. Please try:
- A full IANA timezone name (e.g., Asia/Dhaka, Europe/London)
- A GMT/UTC offset (e.g., GMT+6, UTC-5)
- A common city or country name, or abbreviation (e.g., Dhaka, London, India, PST)

You can find a list of IANA timezones here: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones`);
            return;
        }

        try {
            // Update user's custom data with the new timezone
            if (!user.custom) {
                user.custom = {};
            }
            user.custom.timezone = newTimezone;
            await userDb.saveUser(senderId, user);
            logger.info(`User ${senderId} set timezone to ${newTimezone}`);
            const successMessage = isGMT 
                ? `Your timezone has been set to ${newTimezone} (based on your ${inputRaw} input). Moment messages will now be sent based on this timezone.`
                : `Your timezone has been set to ${newTimezone}. Moment messages will now be sent based on this timezone.`;
            await reply(successMessage);
        } catch (error) {
            logger.error(`Error saving timezone for user ${senderId}:`, error);
            await reply("There was an error saving your timezone. Please try again later.");
        }
    }
}; 