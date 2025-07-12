import axios from 'axios';

export default {
    name: 'weather',
    description: 'Get current weather for a city. Example: {prefix}weather Dhaka',
    usage: '{prefix}weather <city>',
    category: 'utility',
    async onCall({ args, reply, user }) {
        const userPrefix = (user && user.custom && user.custom.prefix) ? user.custom.prefix : '!';
        if (!args.length) {
            await reply(`Please provide a city name. Example: ${userPrefix}weather Dhaka`);
            return;
        }
        const cityQuery = args.join(' ');
        try {
            const url = `https://wttr.in/${encodeURIComponent(cityQuery)}?format=j1`;
            const { data } = await axios.get(url, { timeout: 5000 });
            if (!data.current_condition || !data.current_condition[0]) {
                await reply('Could not find weather data for that city. Please check the city name and try again.');
                return;
            }
            const current = data.current_condition[0];
            const area = data.nearest_area && data.nearest_area[0];
            const city = area && area.areaName && area.areaName[0] ? area.areaName[0].value : cityQuery;
            const country = area && area.country && area.country[0] ? area.country[0].value : '';
            const today = data.weather && data.weather[0];
            const astronomy = today && today.astronomy && today.astronomy[0];
            const minTemp = today ? today.mintempC : null;
            const maxTemp = today ? today.maxtempC : null;
            const rainChance = today && today.hourly ? Math.max(...today.hourly.map(h => parseInt(h.chanceofrain||'0',10))) : null;
            const moon = astronomy ? astronomy.moon_phase : null;
            const uv = current.uvIndex;
            const cloud = current.cloudcover;
            const hourly = today && today.hourly ? today.hourly : [];
            // Find the next 3-hour forecast after now
            const nowHour = parseInt(current.observation_time.split(':')[0], 10);
            const nextForecast = hourly.find(h => parseInt(h.time, 10) / 100 > nowHour) || hourly[0];

            let msg = `🌤️ Weather for *${city}${country ? ', ' + country : ''}*\n`;
            msg += `• Condition: ${current.weatherDesc[0].value}\n`;
            msg += `• Temp: ${current.temp_C}°C / ${current.temp_F}°F (feels like ${current.FeelsLikeC}°C / ${current.FeelsLikeF}°F)\n`;
            if (minTemp && maxTemp) msg += `• Min/Max Today: ${minTemp}°C / ${maxTemp}°C\n`;
            msg += `• Humidity: ${current.humidity}%\n`;
            msg += `• Wind: ${current.windspeedKmph} km/h (${current.winddir16Point})\n`;
            if (current.visibility) msg += `• Visibility: ${current.visibility} km\n`;
            if (current.pressure) msg += `• Pressure: ${current.pressure} mb\n`;
            if (uv) msg += `• UV Index: ${uv}\n`;
            if (cloud) msg += `• Cloud Cover: ${cloud}%\n`;
            if (astronomy) msg += `• Sunrise: ${astronomy.sunrise} | Sunset: ${astronomy.sunset}\n`;
            if (astronomy && astronomy.moonrise && astronomy.moonset) msg += `• Moon: ${moon} | Rise: ${astronomy.moonrise} | Set: ${astronomy.moonset}\n`;
            if (rainChance !== null) msg += `• Rain Chance: ${rainChance}%\n`;
            if (nextForecast && nextForecast.weatherDesc && nextForecast.weatherDesc[0]) {
                msg += `\n🌦️ Next 3h: ${nextForecast.weatherDesc[0].value}, ${nextForecast.tempC}°C, Wind: ${nextForecast.windspeedKmph} km/h`;
            }
            await reply(msg.trim());
        } catch (err) {
            await reply('Failed to fetch weather data. Please check the city name or try again later.');
        }
    }
}; 