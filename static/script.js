// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
                return registration.pushManager.getSubscription()
                    .then(subscription => {
                        if (subscription) {
                            return subscription;
                        }
                        return registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array('BJhxA34BUjlo1psW9x96Q7zakdllLHMJVymunCEt74QMac2GhM95u9NMJ5ZLqxUjkAPdk83ISlo4ccDjSWFeo7I')
                        });
                    });
            })
            .then(subscription => {
                // Send subscription to server
                return fetch('/subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(subscription)
                });
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Function to request notification permission
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Notification permission granted');
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", function () {
    // Request notification permission when the page loads
    requestNotificationPermission();

    const fetchButton = document.getElementById("fetch-button");
    const tabButtons = document.querySelectorAll(".tab-button");
    
    // Initialize charts
    let lineChart = null;
    let barChart = null;
    
    // Commodity and district mappings
    const commodityMap = {
        "3": "Rice",
        "1": "Wheat",
        "4": "Maize",
        "5": "Jowar",
        "30": "Ragi",
        "97": "Pulses",
        "6": "Bengal Gram",
        "7": "Red Gram",
        "8": "Black Gram",
        "9": "Green Gram",
        "114": "Horse Gram"
    };

    const districtMap = {
        "556": "Bagalkot",
        "572": "Bangalore",
        "583": "Bangalore Rural",
        "565": "Bellary",
        "558": "Bidar",
        "557": "Bijapur",
        "578": "Chamarajanagar",
        "582": "Chikkaballapura",
        "570": "Chikmagalur",
        "566": "Chitradurga",
        "575": "Dakshina Kannada",
        "567": "Davanagere",
        "562": "Dharwad",
        "561": "Gadag",
        "579": "Gulbarga",
        "574": "Hassan",
        "564": "Haveri",
        "576": "Kodagu",
        "581": "Kolar",
        "560": "Koppal",
        "573": "Mandya",
        "577": "Mysore",
        "584": "Ramanagara",
        "559": "Raichur",
        "568": "Shimoga",
        "571": "Tumkur",
        "569": "Udupi",
        "563": "Uttara Kannada",
        "580": "Yadgir"
    };
    
    // Setup event listeners
    fetchButton.addEventListener("click", fetchPrices);
    
    // Tab switching logic
    tabButtons.forEach(button => {
        button.addEventListener("click", function() {
            const chartId = this.getAttribute("data-chart");
            
            // Update active tab
            tabButtons.forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");
            
            // Show selected chart, hide others
            document.querySelectorAll(".chart-container canvas").forEach(canvas => {
                canvas.style.display = "none";
            });
            document.getElementById(chartId).style.display = "block";
        });
    });
    
    // Function to fetch price data
    function fetchPrices() {
        const commodityId = document.getElementById("commodity").value;
        const districtId = document.getElementById("district").value;
        const calculationType = document.getElementById("calculation_type").value;
        const startDate = document.getElementById("start_date").value;
        const endDate = document.getElementById("end_date").value;
        
        // Show loading indicators
        document.getElementById("priceTable").innerHTML = "<tr><td colspan='6'>Loading data...</td></tr>";
        document.getElementById("price-summary").querySelector(".summary-content").innerHTML = "<p>Loading summary...</p>";
        
        // Clear existing charts
        if (lineChart) lineChart.destroy();
        if (barChart) barChart.destroy();

        fetch("/fetch_data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                commodity_id: commodityId,
                district_id: districtId,
                calculation_type: calculationType,
                start_date: startDate,
                end_date: endDate
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log("API Response:", data);
            updateTable(data, commodityId, districtId);
            updateCharts(data);
            updateSummary(data, commodityId, districtId);
        })
        .catch(error => {
            console.error("Error fetching data:", error);
            document.getElementById("priceTable").innerHTML = "<tr><td colspan='6'>Error loading data</td></tr>";
            document.getElementById("price-summary").querySelector(".summary-content").innerHTML = "<p>Failed to load data. Please try again.</p>";
        });
    }
    
    // Function to update the data table
    function updateTable(data, commodityId, districtId) {
        const tableBody = document.getElementById("priceTable");
        tableBody.innerHTML = "";
    
        if (data.error) {
            tableBody.innerHTML = `<tr><td colspan="6">${data.error}</td></tr>`;
            return;
        }
    
        if (data.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='6'>No data available for the selected filters</td></tr>";
            return;
        }
    
        data.forEach(entry => {
            const row = `<tr>
                <td>${formatDate(entry.date)}</td>
                <td>${entry.commodity_name || commodityMap[commodityId] || "Unknown"}</td>
                <td>${districtMap[districtId] || "Unknown"}</td>
                <td>₹${formatPrice(entry.avg_min_price)}</td>
                <td>₹${formatPrice(entry.avg_max_price)}</td>
                <td>₹${formatPrice(entry.avg_modal_price)}</td>
            </tr>`;
            tableBody.innerHTML += row;
        });
    }
    
    
    // Function to update price summary
    function updateSummary(data, commodityId, districtId) {
        const summaryContainer = document.getElementById("price-summary").querySelector(".summary-content");
        
        if (data.error || data.length === 0) {
            summaryContainer.innerHTML = "<p>No data available for the selected filters</p>";
            return;
        }
        
        // Calculate summary statistics
        const commodityName = commodityMap[commodityId] || "Unknown";
        const districtName = districtMap[districtId] || "Unknown";
        
        // Extract modal prices and calculate stats
        const modalPrices = data.map(item => parseFloat(item.avg_modal_price) || 0).filter(price => price > 0);
        
        if (modalPrices.length === 0) {
            summaryContainer.innerHTML = "<p>No valid price data available</p>";
            return;
        }
        
        const avgPrice = modalPrices.reduce((sum, price) => sum + price, 0) / modalPrices.length;
        const minPrice = Math.min(...modalPrices);
        const maxPrice = Math.max(...modalPrices);
        
        // Calculate price trend (comparing first and last data points)
        const firstPrice = modalPrices[modalPrices.length - 1]; // Oldest price
        const lastPrice = modalPrices[0]; // Newest price
        const priceChange = lastPrice - firstPrice;
        const percentChange = (priceChange / firstPrice) * 100;
        
        // Generate trend indicator
        let trendIndicator = "";
        let trendClass = "";
        
        if (percentChange > 0) {
            trendIndicator = "↗";
            trendClass = "trend-up";
        } else if (percentChange < 0) {
            trendIndicator = "↘";
            trendClass = "trend-down";
        } else {
            trendIndicator = "→";
            trendClass = "trend-stable";
        }
        
        // Create summary HTML
        summaryContainer.innerHTML = `
            <div class="summary-item">
                <span class="label">Commodity:</span>
                <span class="value">${commodityName}</span>
            </div>
            <div class="summary-item">
                <span class="label">District:</span>
                <span class="value">${districtName}</span>
            </div>
            <div class="summary-item">
                <span class="label">Average Price:</span>
                <span class="value">₹${formatPrice(avgPrice)}</span>
            </div>
            <div class="summary-item">
                <span class="label">Price Range:</span>
                <span class="value">₹${formatPrice(minPrice)} - ₹${formatPrice(maxPrice)}</span>
            </div>
            <div class="summary-item highlight">
                <span class="label">Price Trend:</span>
                <span class="value ${trendClass}">
                    ${trendIndicator} ${percentChange.toFixed(2)}% 
                    (₹${formatPrice(priceChange)})
                </span>
            </div>
        `;
    }
    
    // Function to update charts
    function updateCharts(data) {
        if (data.error || data.length === 0) {
            return;
        }
        
        // Reverse data to get chronological order
        const chartData = [...data].reverse();
        
        // Prepare labels and datasets
        const labels = chartData.map(item => formatDate(item.date));
        const minPrices = chartData.map(item => parseFloat(item.avg_min_price) || null);
        const maxPrices = chartData.map(item => parseFloat(item.avg_max_price) || null);
        const modalPrices = chartData.map(item => parseFloat(item.avg_modal_price) || null);
        
        // Create line chart
        const lineCtx = document.getElementById('price-line-chart').getContext('2d');
        lineChart = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Modal Price',
                        data: modalPrices,
                        borderColor: '#2c8c40',
                        backgroundColor: 'rgba(44, 140, 64, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.2,
                        pointRadius: 4,
                        pointBackgroundColor: '#2c8c40'
                    },
                    {
                        label: 'Max Price',
                        data: maxPrices,
                        borderColor: '#ffc107',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 3,
                        pointBackgroundColor: '#ffc107',
                        borderDash: [5, 5]
                    },
                    {
                        label: 'Min Price',
                        data: minPrices,
                        borderColor: '#6c757d',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 3,
                        pointBackgroundColor: '#6c757d',
                        borderDash: [2, 2]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Price Trends Over Time',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ₹' + context.raw.toFixed(2);
                            }
                        }
                    },
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Price (₹)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '₹' + value;
                            }
                        }
                    }
                }
            }
        });
        
        // Create bar chart
        const barCtx = document.getElementById('price-bar-chart').getContext('2d');
        barChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Modal Price',
                        data: modalPrices,
                        backgroundColor: 'rgba(44, 140, 64, 0.7)',
                        borderColor: 'rgba(44, 140, 64, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Modal Price Comparison',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ₹' + context.raw.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Price (₹)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '₹' + value;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Helper function to format dates
    function formatDate(dateStr) {
        if (!dateStr) return "N/A";
        
        // Handle both daily dates (YYYY-MM-DD) and monthly dates (MMM YYYY)
        if (dateStr.includes("-")) {
            const parts = dateStr.split("-");
            if (parts.length === 3) {
                const date = new Date(parts[0], parts[1] - 1, parts[2]);
                return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            }
        }
        
        return dateStr;
    }
    
    // Helper function to format prices
    function formatPrice(price) {
        if (!price || isNaN(price)) return "N/A";
        return parseFloat(price).toFixed(2);
    }
    // Profit Calculator Logic
    const calculateButton = document.getElementById("calculate-profit");
    if (calculateButton) {
        calculateButton.addEventListener("click", calculateProfit);
    }

    function calculateProfit() {
        const sellingPrice = parseFloat(document.getElementById("selling-price").value) || 0;
        const yieldPerAcre = parseFloat(document.getElementById("yield-per-acre").value) || 0;
        const costPerAcre = parseFloat(document.getElementById("cost-per-acre").value) || 0;
        const landSize = parseFloat(document.getElementById("land-size").value) || 0;
        
        // Calculate total values
        const totalYield = yieldPerAcre * landSize;
        const totalRevenue = sellingPrice * totalYield;
        const totalCost = costPerAcre * landSize;
        const totalProfit = totalRevenue - totalCost;
        const profitPerAcre = landSize > 0 ? totalProfit / landSize : 0;
        const returnOnInvestment = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
        
        // Create profit status class and text
        const profitClass = totalProfit >= 0 ? "profit-positive" : "profit-negative";
        const profitStatus = totalProfit >= 0 ? 
            getTranslation("profitCalculator.results.positive") : 
            getTranslation("profitCalculator.results.negative");
        
        // Update results
        const resultsContainer = document.getElementById("profit-results");
        resultsContainer.innerHTML = `
            <div class="result-row">
                <span class="label">${getTranslation("profitCalculator.totalYield")}</span>
                <span class="value">${totalYield.toFixed(2)} ${getTranslation("profitCalculator.results.quintals")}</span>
            </div>
            <div class="result-row">
                <span class="label">${getTranslation("profitCalculator.totalRevenue")}</span>
                <span class="value">${getTranslation("profitCalculator.results.rupees")}${totalRevenue.toFixed(2)}</span>
            </div>
            <div class="result-row">
                <span class="label">${getTranslation("profitCalculator.totalCost")}</span>
                <span class="value">${getTranslation("profitCalculator.results.rupees")}${totalCost.toFixed(2)}</span>
            </div>
            <div class="result-row">
                <span class="label">${getTranslation("profitCalculator.profitPerAcre")}</span>
                <span class="value ${profitClass}">${getTranslation("profitCalculator.results.rupees")}${profitPerAcre.toFixed(2)}</span>
            </div>
            <div class="result-row">
                <span class="label">${getTranslation("profitCalculator.totalProfit")}</span>
                <span class="value ${profitClass}">${getTranslation("profitCalculator.results.rupees")}${totalProfit.toFixed(2)} (${profitStatus})</span>
            </div>
            <div class="result-row">
                <span class="label">${getTranslation("profitCalculator.roi")}</span>
                <span class="value ${profitClass}">${returnOnInvestment.toFixed(2)}${getTranslation("profitCalculator.results.percent")}</span>
            </div>
        `;
    }
    // Crop Recommendation System
    const recommendButton = document.getElementById("recommend-crops");
    if (recommendButton) {
        recommendButton.addEventListener("click", recommendCrops);
    }

    // Crop database with soil and season compatibility
    const cropDatabase = {
        rice: {
            name: "Rice (Paddy)",
            soilTypes: ["clay", "loamy", "alluvial"],
            seasons: ["kharif"],
            waterNeeds: "high",
            idealFarmSize: ["medium", "large"],
            details: "Staple food crop with good market demand. Requires standing water during growth."
        },
        wheat: {
            name: "Wheat",
            soilTypes: ["loamy", "black", "alluvial"],
            seasons: ["rabi"],
            waterNeeds: "medium",
            idealFarmSize: ["medium", "large"],
            details: "Important cereal crop with consistent demand. Good for rotation with rice."
        },
        maize: {
            name: "Maize (Corn)",
            soilTypes: ["loamy", "sandy", "alluvial"],
            seasons: ["kharif", "rabi", "summer"],
            waterNeeds: "medium",
            idealFarmSize: ["small", "medium", "large"],
            details: "Versatile crop used for food, feed and industrial purposes. Quick growing."
        },
        sugarcane: {
            name: "Sugarcane",
            soilTypes: ["loamy", "alluvial", "black"],
            seasons: ["year_round"],
            waterNeeds: "high",
            idealFarmSize: ["medium", "large"],
            details: "Long duration crop with good returns. Requires regular irrigation and maintenance."
        },
        cotton: {
            name: "Cotton",
            soilTypes: ["black", "alluvial", "red"],
            seasons: ["kharif"],
            waterNeeds: "medium",
            idealFarmSize: ["medium", "large"],
            details: "Major cash crop. Requires moderate water and pest control measures."
        },
        pulses: {
            name: "Pulses (Lentils, Chickpeas)",
            soilTypes: ["loamy", "sandy", "red"],
            seasons: ["rabi", "kharif"],
            waterNeeds: "low",
            idealFarmSize: ["small", "medium"],
            details: "Nitrogen fixing crop, good for soil health and crop rotation. Low water requirement."
        },
        oilseeds: {
            name: "Oilseeds (Mustard, Groundnut)",
            soilTypes: ["sandy", "loamy", "red"],
            seasons: ["rabi", "kharif"],
            waterNeeds: "low",
            idealFarmSize: ["small", "medium"],
            details: "Good returns with relatively low inputs. Drought resistant varieties available."
        },
        vegetables: {
            name: "Vegetables",
            soilTypes: ["loamy", "sandy", "alluvial"],
            seasons: ["year_round"],
            waterNeeds: "medium",
            idealFarmSize: ["small"],
            details: "High value crops with quick returns. Good for small holdings with market access."
        },
        fruits: {
            name: "Fruit Orchards",
            soilTypes: ["loamy", "sandy", "red", "alluvial"],
            seasons: ["year_round"],
            waterNeeds: "medium",
            idealFarmSize: ["medium", "large"],
            details: "Long term investment with high returns. Requires initial capital and patience."
        },
        turmeric: {
            name: "Turmeric",
            soilTypes: ["loamy", "sandy", "red"],
            seasons: ["kharif"],
            waterNeeds: "medium",
            idealFarmSize: ["small"],
            details: "Spice crop with good market value. Takes 9-10 months to mature."
        },
        millets: {
            name: "Millets (Jowar, Bajra, Ragi)",
            soilTypes: ["red", "sandy", "loamy"],
            seasons: ["kharif"],
            waterNeeds: "low",
            idealFarmSize: ["small", "medium"],
            details: "Drought resistant crops with low maintenance. Nutritious and gaining market demand."
        },
        jute: {
            name: "Jute",
            soilTypes: ["loamy", "alluvial"],
            seasons: ["kharif"],
            waterNeeds: "high",
            idealFarmSize: ["medium"],
            details: "Important fiber crop. Requires humid conditions and adequate rainfall."
        }
    };

    function recommendCrops() {
        const soilType = document.getElementById("soil-type").value;
        const season = document.getElementById("season").value;
        const waterAvailability = document.getElementById("water-availability").value;
        const farmSize = document.getElementById("farm-size").value;
        
        const recommendationsContainer = document.getElementById("crop-recommendations");
        
        // Filter and score crops based on input parameters
        const scoredRecommendations = [];
        
        for (const [cropId, cropData] of Object.entries(cropDatabase)) {
            let score = 0;
            
            // Check soil compatibility
            if (cropData.soilTypes.includes(soilType)) {
                score += 3;
            }
            
            // Check season compatibility
            if (cropData.seasons.includes(season) || cropData.seasons.includes("year_round")) {
                score += 3;
            }
            
            // Check water needs compatibility
            if (cropData.waterNeeds === waterAvailability) {
                score += 2;
            } else if ((cropData.waterNeeds === "medium" && waterAvailability === "high") || 
                    (cropData.waterNeeds === "low" && waterAvailability !== "low")) {
                score += 1;
            }
            
            // Check farm size compatibility
            if (cropData.idealFarmSize.includes(farmSize)) {
                score += 1;
            }
            
            // Only include crops with some compatibility
            if (score > 3) {
                let suitabilityClass = "medium-suit";
                let suitabilityText = getTranslation("cropRecommendation.medium");
                
                if (score >= 7) {
                    suitabilityClass = "high-suit";
                    suitabilityText = getTranslation("cropRecommendation.high");
                } else if (score <= 4) {
                    suitabilityClass = "low-suit";
                    suitabilityText = getTranslation("cropRecommendation.fair");
                }
                
                scoredRecommendations.push({
                    id: cropId,
                    name: getTranslation(`cropRecommendation.crops.${cropId}`),
                    score: score,
                    details: cropData.details,
                    suitabilityClass: suitabilityClass,
                    suitabilityText: suitabilityText
                });
            }
        }
        
        // Sort recommendations by score (highest first)
        scoredRecommendations.sort((a, b) => b.score - a.score);
        
        // Display recommendations
        if (scoredRecommendations.length > 0) {
            let recommendationsHTML = `
                <h3>${getTranslation("cropRecommendation.title")} - 
                ${document.getElementById("soil-type").options[document.getElementById("soil-type").selectedIndex].text} 
                ${getTranslation("cropRecommendation.season")} 
                ${document.getElementById("season").options[document.getElementById("season").selectedIndex].text}</h3>
                <div class="crop-card">
            `;
            
            // Take top 6 recommendations
            const topRecommendations = scoredRecommendations.slice(0, 6);
            
            topRecommendations.forEach(crop => {
                recommendationsHTML += `
                    <div class="crop-item">
                        <div class="crop-name">${crop.name}</div>
                        <div class="crop-details">${crop.details}</div>
                        <div class="crop-suitability ${crop.suitabilityClass}">
                            ${getTranslation("cropRecommendation.suitability")} ${crop.suitabilityText}
                        </div>
                    </div>
                `;
            });
            
            recommendationsHTML += `</div>`;
            recommendationsContainer.innerHTML = recommendationsHTML;
        } else {
            recommendationsContainer.innerHTML = `
                <p>${getTranslation("cropRecommendation.selectParameters")}</p>
            `;
        }
    }
    // Weather Display Functionality
    const weatherButton = document.getElementById("get-weather");
    if (weatherButton) {
        weatherButton.addEventListener("click", fetchWeather);
        
        // Fetch weather on initial load - adding a small delay to ensure DOM is fully loaded
        setTimeout(fetchWeather, 500);
    }

    // Weather API configuration
    const weatherApiKey = "4e3dc91be1a4e75ccf8851a5b8532b00"; // You might need to replace this with a valid API key

    function fetchWeather() {
        const locationSelect = document.getElementById("location-select");
        const [lat, lon] = locationSelect.value.split(",");
        const locationName = locationSelect.options[locationSelect.selectedIndex].text;
        
        const weatherContent = document.querySelector(".weather-content");
        weatherContent.innerHTML = "<p>Loading weather data...</p>";
        
        // Use a proxy server to avoid CORS issues or replace with your backend endpoint
        const proxyUrl = '';  // If you have a proxy, add it here
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${weatherApiKey}`;
        
        // Log request for debugging
        console.log(`Fetching weather data for ${locationName}...`);
        
        // Create a backend endpoint in your Flask app to handle the OpenWeatherMap API request
        fetch('/get_weather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lon })
        })
        .then(response => {
            console.log('Weather API response status:', response.status);
            if (!response.ok) {
                throw new Error(`Weather API error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Weather data received:', data);
            if (data.error) {
                throw new Error(data.error);
            }
            displayWeather(data, locationName);
        })
        .catch(error => {
            console.error("Weather API error:", error);
            weatherContent.innerHTML = `
                <div class="weather-error">
                    <p>Could not load weather data. Please try again later.</p>
                    <p class="error-details">Error: ${error.message}</p>
                </div>`;
        });
    }

    function displayWeather(data, locationName) {
        const weatherContent = document.querySelector(".weather-content");
        
        if (!data || !data.main) {
            weatherContent.innerHTML = "<p>Weather data not available</p>";
            return;
        }
        
        const temp = Math.round(data.main.temp);
        const feelsLike = Math.round(data.main.feels_like);
        const description = data.weather[0].description;
        const iconCode = data.weather[0].icon;
        const humidity = data.main.humidity;
        const windSpeed = data.wind.speed;
        const pressure = data.main.pressure;
        const visibility = data.visibility / 1000; // Convert to km
        
        // Get local time
        const timestamp = data.dt * 1000;
        const date = new Date(timestamp);
        const localTime = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        // Check if it's agricultural weather condition
        const isRainy = data.weather[0].main.toLowerCase().includes("rain");
        const isClear = data.weather[0].main.toLowerCase().includes("clear");
        const farmingTip = getFarmingWeatherTip(data.weather[0].main, temp);
        
        weatherContent.innerHTML = `
            <div class="weather-header">
                <span class="weather-location">${locationName}</span>
                <span class="weather-time">Updated: ${localTime}</span>
            </div>
            <div class="weather-main">
                <div>
                    <div class="weather-temp">${temp}°C</div>
                    <div class="weather-description">${description}</div>
                </div>
                <div class="weather-icon">
                    <img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="${description}">
                </div>
            </div>
            <div class="weather-details">
                <div class="weather-detail-item">
                    <span class="detail-label">Feels Like</span>
                    <span class="detail-value">${feelsLike}°C</span>
                </div>
                <div class="weather-detail-item">
                    <span class="detail-label">Humidity</span>
                    <span class="detail-value">${humidity}%</span>
                </div>
                <div class="weather-detail-item">
                    <span class="detail-label">Wind</span>
                    <span class="detail-value">${windSpeed} m/s</span>
                </div>
                <div class="weather-detail-item">
                    <span class="detail-label">Pressure</span>
                    <span class="detail-value">${pressure} hPa</span>
                </div>
            </div>
            <div class="farming-tip">
                <strong>Farming Tip:</strong> ${farmingTip}
            </div>
        `;
    }

    function getFarmingWeatherTip(weatherCondition, temperature) {
        // Farm activity recommendations based on weather
        weatherCondition = weatherCondition.toLowerCase();
        
        if (weatherCondition.includes("rain") || weatherCondition.includes("drizzle")) {
            return "Avoid spraying pesticides as rain may wash them away. Good time for transplanting seedlings.";
        } else if (weatherCondition.includes("thunderstorm")) {
            return "Keep livestock sheltered. Avoid field work due to lightning risk.";
        } else if (weatherCondition.includes("clear") || weatherCondition.includes("sun")) {
            if (temperature > 35) {
                return "High temperature alert. Ensure adequate irrigation and avoid midday field operations.";
            } else {
                return "Good conditions for harvesting and drying crops. Consider mulching to retain soil moisture.";
            }
        } else if (weatherCondition.includes("cloud")) {
            return "Moderate conditions for field work. Good time for fertilizer application if no rain expected.";
        } else if (weatherCondition.includes("fog") || weatherCondition.includes("mist")) {
            return "Watch for fungal diseases in these humid conditions. Delay spraying operations.";
        } else if (weatherCondition.includes("snow") || temperature < 5) {
            return "Protect sensitive crops from frost. Ensure proper covering for seedbeds.";
        } else {
            return "Check soil moisture and plan field activities accordingly.";
        }
    }
    
    // Translation functionality
    let translations = {};
    let currentLanguage = 'en';

    // Load translations
    async function loadTranslations(lang) {
        try {
            const response = await fetch(`/static/translations/${lang}.json`);
            translations = await response.json();
            currentLanguage = lang;
            applyTranslations();
        } catch (error) {
            console.error('Error loading translations:', error);
        }
    }

    // Apply translations to all elements with data-i18n attribute
    function applyTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = getTranslation(key);
            if (translation) {
                if (element.tagName === 'INPUT' && element.type === 'button') {
                    element.value = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });
    }

    // Get translation for a key
    function getTranslation(key) {
        const keys = key.split('.');
        let value = translations;
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return null;
            }
        }
        return value;
    }

    // Language switcher event listener
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            loadTranslations(e.target.value);
        });
    }

    // Load initial translations
    loadTranslations(currentLanguage);
});