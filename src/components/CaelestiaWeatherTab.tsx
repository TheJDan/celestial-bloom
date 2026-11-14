import React from "react";
import {
	Cloud,
	CloudRain,
	CloudSun,
	Droplets,
	Wind,
	Sun,
	Compass,
	Thermometer,
	Eye
} from "lucide-react";
import "./CaelestiaTabs.css";

interface WeatherProps {
	temperature: number | null;
	weatherCondition: string;
	cityName: string;
	tempUnit?: string;
}

export function CaelestiaWeatherTab({
	temperature,
	weatherCondition,
	cityName,
	tempUnit = "celsius"
}: WeatherProps) {
	const currentTemp = temperature !== null ? Math.round(temperature) : 9;
	const city = cityName || "Quito, Ecuador";
	const condition = weatherCondition || "Mayormente Despejado";

	// Realistic hourly forecast based on current temp
	const hourly = [
		{ time: "Ahora", temp: currentTemp, icon: <Sun size={18} /> },
		{ time: "04:00", temp: currentTemp - 1, icon: <CloudSun size={18} /> },
		{ time: "07:00", temp: currentTemp + 2, icon: <Sun size={18} /> },
		{ time: "10:00", temp: currentTemp + 6, icon: <Sun size={18} /> },
		{ time: "13:00", temp: currentTemp + 9, icon: <CloudSun size={18} /> },
		{ time: "16:00", temp: currentTemp + 5, icon: <CloudRain size={18} /> },
		{ time: "19:00", temp: currentTemp + 1, icon: <Cloud size={18} /> }
	];

	const daily = [
		{ day: "Hoy", high: currentTemp + 10, low: currentTemp - 2, cond: "Soleado" },
		{ day: "Mié", high: currentTemp + 9, low: currentTemp - 1, cond: "Parcialmente nublado" },
		{ day: "Jue", high: currentTemp + 8, low: currentTemp, cond: "Lluvia ligera" },
		{ day: "Vie", high: currentTemp + 11, low: currentTemp + 1, cond: "Despejado" },
		{ day: "Sáb", high: currentTemp + 10, low: currentTemp, cond: "Soleado" }
	];

	return (
		<div className="caelestia-tab-body">
			<div className="cweather-container">
				{/* ── Left Card: Current Weather Hero ── */}
				<div className="cweather-hero-card">
					<div className="cweather-hero-header">
						<div className="cweather-city-badge">
							<Compass size={12} />
							<span>{city}</span>
						</div>
						<span className="cweather-date-badge">
							{new Date().toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
						</span>
					</div>

					<div className="cweather-hero-main">
						<div className="cweather-hero-icon-wrap">
							<Sun size={48} className="cweather-sun-glow" />
						</div>
						<div className="cweather-temp-wrap">
							<span className="cweather-big-temp">{currentTemp}°</span>
							<span className="cweather-cond-label">{condition}</span>
						</div>
					</div>

					<div className="cweather-hero-stats">
						<div className="cweather-stat-pill">
							<Droplets size={12} />
							<span>68% Humedad</span>
						</div>
						<div className="cweather-stat-pill">
							<Wind size={12} />
							<span>11 km/h Viento</span>
						</div>
						<div className="cweather-stat-pill">
							<Thermometer size={12} />
							<span>Sensación {currentTemp + 1}°</span>
						</div>
					</div>
				</div>

				{/* ── Right Column: Hourly & 5-Day Forecast ── */}
				<div className="cweather-right-col">
					{/* Hourly Strip */}
					<div className="cweather-hourly-card">
						<span className="cweather-subheading">Pronóstico por horas</span>
						<div className="cweather-hourly-track">
							{hourly.map((h, i) => (
								<div key={i} className="cweather-hour-item">
									<span className="cweather-hour-time">{h.time}</span>
									<div className="cweather-hour-icon">{h.icon}</div>
									<span className="cweather-hour-temp">{h.temp}°</span>
								</div>
							))}
						</div>
					</div>

					{/* 5-Day Outlook */}
					<div className="cweather-daily-card">
						<span className="cweather-subheading">Próximos días</span>
						<div className="cweather-daily-list">
							{daily.map((d, i) => (
								<div key={i} className="cweather-daily-row">
									<span className="cweather-daily-day">{d.day}</span>
									<span className="cweather-daily-cond">{d.cond}</span>
									<div className="cweather-daily-range">
										<span className="cweather-range-low">{d.low}°</span>
										<div className="cweather-range-bar">
											<div
												className="cweather-range-fill"
												style={{
													left: `${(d.low / 25) * 100}%`,
													width: `${((d.high - d.low) / 25) * 100}%`
												}}
											/>
										</div>
										<span className="cweather-range-high">{d.high}°</span>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
