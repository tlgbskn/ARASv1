document.addEventListener('DOMContentLoaded', function() {
    var map = L.map('mapid').setView([39.925533, 32.866287], 13);
    var mevziMenzilleri = [];
    var markers=[];
    var markerRange = 0;

    var satelliteLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    var measureControl = L.control.measure({
        position: 'topleft',
        primaryLengthUnit: 'meters',
        secondaryLengthUnit: 'kilometers',
        primaryAreaUnit: 'sqmeters',
        secondaryAreaUnit: 'hectares',
        activeColor: '#db4a29',
        completedColor: '#9b2d14'
    }).addTo(map);

    // Ölçüm aracındaki otomatik odağın engellenmesi
    L.Control.Measure.include({
        _setCaptureMarkerIcon: function() {
            this._captureMarker.options.autoPanOnFocus = false;
            this._captureMarker.setIcon(L.divIcon({
                iconSize: this._map.getSize().multiplyBy(2)
            }));
        },
    });

    var topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data © <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
    });

    var baseMaps = {
        "Uydu Görüntüsü": satelliteLayer,
        "Topoğrafik Harita": topoLayer
    };

    L.control.layers(baseMaps).addTo(map);

    var markers = [];
    var weaponSystems = [
        { name: '120mm Havan', range: 8750, cost: 2000, effectiveness: 0.8, fireRate: 8, defense: 6 },
        { name: '81mm Havan', range: 5850, cost: 1500, effectiveness: 0.7, fireRate: 5, defense: 5 },
        { name: 'Fırtına Obüs', range: 40500, cost: 8000, effectiveness: 0.9, fireRate: 9, defense: 7 }
    ];

    function addMarker(latlng, type, label) {
        var color = {
            hedef: 'red',
            mevzii: 'blue',
            kisitlama: 'green'
        }[type];
    
        var iconHtml = `<div style='position: relative;'>
                            <div style='position: absolute; top: -24px; left: -50%; width: 100px; text-align: center; background-color: white; color: black; border-radius: 5px; padding: 2px;'>
                                ${label}
                            </div>
                            <div style='background-color:${color}; width:12px; height:12px; border-radius:50%;'></div>
                        </div>`;
    
        var marker = L.marker(latlng, {
            draggable: true,
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: iconHtml,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            })
        }).addTo(map);

        var id = markers.length + 1; // Benzersiz bir ID ata
        marker.id = id;
        
        var popupContent = document.createElement('div');
        popupContent.innerHTML = `Tür: ${type}<br>Koordinatlar: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}<br>Etiket: ${label}`;
        if (type === 'mevzii') {
            var select = document.createElement('select');
            select.innerHTML = '<option value="">Seçiniz</option>';
            weaponSystems.forEach(function(system) {
                select.innerHTML += `<option value="${system.range}" data-cost="${system.cost}" data-effectiveness="${system.effectiveness}" data-fireRate="${system.fireRate}">${system.name}</option>`;
            });
            popupContent.appendChild(document.createElement('br'));
            popupContent.appendChild(select);
    
            select.addEventListener('change', function() {
                var selectedOption = select.options[select.selectedIndex];
                markerRange = parseInt(selectedOption.value, 10) || 0;
                var systemCost = parseFloat(selectedOption.getAttribute('data-cost')) || 0;
                var systemEffectiveness = parseFloat(selectedOption.getAttribute('data-effectiveness')) || 0;
                var systemFireRate = parseFloat(selectedOption.getAttribute('data-fireRate')) || 0;
                
                if (marker.circle) {
                    marker.circle.setRadius(markerRange);
                }
                
                mevziMenzilleri[id - 1] = { range: markerRange, cost: systemCost, effectiveness: systemEffectiveness, fireRate: systemFireRate };
            });
        }
        
        marker.bindPopup(popupContent);
        mevziMenzilleri[id - 1] = { range: markerRange, cost: 0, effectiveness: 0, fireRate: 0 };

        var circleRadius = (type === 'kisitlama' ? 800 : 0);
        if (type === 'kisitlama' || type === 'mevzii') {
            var circle = L.circle(latlng, {
                color: 'black',
                fillColor: color,
                fillOpacity: 0.1,
                radius: circleRadius,
                dashArray: '10, 5',
                dashOffset: '0'
            }).addTo(map);
            marker.circle = circle;
        }
               
        marker.on('dragend', function() {
            var newLatLng = this.getLatLng();
            this.setLatLng(newLatLng).update();
            if (this.circle) {
                this.circle.setLatLng(newLatLng);
            }
            markers = markers.map(m => {
                if (m.marker === this) {
                    return { ...m, latlng: newLatLng };
                } else {
                    return m;
                }
            });
        });
        
        marker.on('contextmenu', function() {
            map.removeLayer(marker);
            if (marker.circle) {
                map.removeLayer(marker.circle);
            }
            markers = markers.filter(m => m.marker !== marker);
        });

        markers.push({marker: marker, type: type, label: label, latlng: latlng, circle: marker.circle, id: id});
        if (type === 'hedef') {
            updateTargetOptions();
        }
    }

    map.on('click', function(e) {
        var type = document.getElementById('manualType').value || 'hedef';
        var label = prompt("İşaretçi için etiket girin:");
        if (label !== null && label !== "") {
            addMarker(e.latlng, type, label);
        }
    });

    document.getElementById('addManualMarkerBtn').addEventListener('click', function() {
        var lat = parseFloat(document.getElementById('latitude').value);
        var lng = parseFloat(document.getElementById('longitude').value);
        var type = document.getElementById('manualType').value;
        var label = document.getElementById('manualLabel').value;

        if (!lat || !lng || !label) {
            alert('Lütfen tüm alanları doldurun ve geçerli koordinatlar girin!');
            return;
        }

        var latlng = L.latLng(lat, lng);
        addMarker(latlng, type, label);
    });

    document.getElementById('deleteMarkerBtn').addEventListener('click', function() {
        if (markers.length > 0) {
            var lastMarker = markers.pop();
            map.removeLayer(lastMarker.marker);
            if (lastMarker.circle) {
                map.removeLayer(lastMarker.circle);
            }
        } else {
            alert("Silinecek işaretçi yok!");
        }
    });

    document.getElementById('exportButton').addEventListener('click', function() {
        exportToExcel(markers);
    });

    function updateTargetOptions() {
        var targetSelect = document.getElementById('targetSelection');
        targetSelect.innerHTML = '<option value="">Hedef Seçiniz</option>';

        markers.forEach(marker => {
            if (marker.type === 'hedef') {
                var option = document.createElement('option');
                option.value = marker.id;
                option.text = marker.label;
                targetSelect.appendChild(option);
            }
        });
    }
    
    function loadExcelData() {
        var fileInput = document.getElementById('fileInput');
        var reader = new FileReader();
    
        reader.onload = function(e) {
            var data = new Uint8Array(e.target.result);
            var workbook = XLSX.read(data, {type: 'array'});
    
            var firstSheetName = workbook.SheetNames[0];
            var worksheet = workbook.Sheets[firstSheetName];
    
            var rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            rows.forEach(function(row, index) {
                if (index > 0) {
                    var latitude = row[0];
                    var longitude = row[1];
                    var type = row[2];
                    var label = row[3];
                    var latLng = L.latLng(latitude, longitude);
                    addMarker(latLng, type, label);
                }
            });
        };
    
        reader.readAsArrayBuffer(fileInput.files[0]);
    }
    
    document.getElementById('fileInputButton').addEventListener('click', loadExcelData);
    
    function exportToExcel(markers) {
        var wb = XLSX.utils.book_new();
        var ws_name = "Koordinatlar ve İlişkiler";

        var headers = ["ID", "Tür", "Enlem", "Boylam", "Etiket"];
        var subHeaders = ["Mesafe (km)", "Açı (derece)", "Yön (milyem)", "Göreceli Yön"];

        var data = [headers.concat(subHeaders)];

        markers.forEach((marker, index) => {
            var row = [index + 1, marker.type, marker.latlng.lat, marker.latlng.lng, marker.label];
            markers.forEach(otherMarker => {
                if (['mevzii', 'kisitlama'].includes(marker.type) && otherMarker.type === 'hedef') {
                    var distance = haversineDistance(marker.latlng, otherMarker.latlng).toFixed(2);
                    var bearing = calculateBearing(marker.latlng, otherMarker.latlng);
                    var mils = degreesToMils(bearing);
                    var direction = getDirectionFromBearing(bearing);
                    row.push(distance, bearing.toFixed(2), mils, direction);
                }
            });
            
            data.push(row);
        });

        var ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, ws_name);
        XLSX.writeFile(wb, "koordinatlar_ve_iliskiler.xlsx");
    }
    
    window.analyzeTargets = function() {
        var selectedTargetId = document.getElementById('targetSelection').value;
        if (!selectedTargetId) {
            alert('Lütfen bir hedef seçin.');
            return;
        }
    
        var selectedTarget = markers.find(marker => marker.id == selectedTargetId);
        if (!selectedTarget) {
            alert('Seçilen hedef bulunamadı.');
            return;
        }
    
        var results = [];
        markers.forEach(marker => {
            if (marker.type === 'mevzii') {
                var markerRange = mevziMenzilleri[marker.id - 1].range || 0;
                var distance = haversineDistance(marker.latlng, selectedTarget.latlng);
                
                var canShoot = markerRange !== undefined && distance <= markerRange;
                var isRestricted = markers.some(restriction => {
                    return restriction.type === 'kisitlama' && haversineDistance(restriction.latlng, selectedTarget.latlng) <= 800;
                });
    
                if (canShoot && !isRestricted) {
                    results.push({ id: marker.id, canShoot: true, label: marker.label });
                } else {
                    results.push({ id: marker.id, canShoot: false, label: marker.label });
                }
            }
        });

        if (results.length === 0) {
            alert('Mevzii yok veya hedefe atış yapılamıyor.');
        } else {
            exportResultsToExcel(results);
            visualizeResultsOnMap(results);
        }
    }
    
    function exportResultsToExcel(results) {
        var wb = XLSX.utils.book_new();
        var ws_name = "Atış Analizi Sonuçları";
        var headers = ["Mevzii ID", "Mevzii Etiket", "Atış Yapabilir"];
        var data = [headers];

        results.forEach(result => {
            var marker = markers.find(m => m.id === result.id);
            var row = [result.id, marker ? marker.label : "", result.canShoot ? "Evet" : "Hayır"];
            data.push(row);
        });

        var ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, ws_name);
        XLSX.writeFile(wb, "atis_analizi_sonuclari.xlsx");
    }

    function haversineDistance(coords1, coords2) {
        function toRad(x) {
            return x * Math.PI / 180;
        }

        var lat1 = coords1.lat;
        var lon1 = coords1.lng;
        var lat2 = coords2.lat;
        var lon2 = coords2.lng;

        var R = 6371000; // Earth's radius in m
        var dLat = toRad(lat2 - lat1);
        var dLon = toRad(lon2 - lon1);
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function calculateBearing(coords1, coords2) {
        function toRad(x) {
            return x * Math.PI / 180;
        }
        var y = Math.sin(toRad(coords2.lng - coords1.lng)) * Math.cos(toRad(coords2.lat));
        var x = Math.cos(toRad(coords1.lat)) * Math.sin(toRad(coords2.lat)) -
                Math.sin(toRad(coords1.lat)) * Math.cos(toRad(coords2.lat)) * Math.cos(toRad(coords2.lng - coords1.lng));
        var brng = Math.atan2(y, x);
        return (brng * (180 / Math.PI) + 360) % 360;
    }

    function degreesToMils(degrees) {
        return (degrees * (6400 / 360)).toFixed(0);
    }

    function getDirectionFromBearing(bearing) {
        if (bearing >= 337.5 || bearing < 22.5) {
            return "K";
        } else if (bearing >= 22.5 && bearing < 67.5) {
            return "KD";
        } else if (bearing >= 67.5 && bearing < 112.5) {
            return "D";
        } else if (bearing >= 112.5 && bearing < 157.5) {
            return "GD";
        } else if (bearing >= 157.5 && bearing < 202.5) {
            return "G";
        } else if (bearing >= 202.5 && bearing < 247.5) {
            return "GB";
        } else if (bearing >= 247.5 && bearing < 292.5) {
            return "B";
        } else if (bearing >= 292.5 && bearing < 337.5) {
            return "KB";
        }
    }

    var arrows = [];
    function drawArrow(fromLatlng, toLatlng, color='red', arrowSize=10, lineLength=40, dashArray='10, 5', dashOffset='0') {
        var polyline = L.polyline([fromLatlng, L.latLng(
            fromLatlng.lat + (toLatlng.lat - fromLatlng.lat) * (lineLength / 100),
            fromLatlng.lng + (toLatlng.lng - fromLatlng.lng) * (lineLength / 100)
        )], {
            color: color,
            dashArray: dashArray,
            dashOffset: dashOffset
        }).addTo(map);

        var arrowHead = L.polylineDecorator(polyline, {
            patterns: [
                {offset: '100%', repeat: 0, symbol: L.Symbol.arrowHead({pixelSize: arrowSize, polygon: false, pathOptions: {stroke: true, color: color, className: 'arrow-head'}})}
            ]
        }).addTo(map);

        arrows.push({ polyline: polyline, arrowHead: arrowHead });
    }

    function drawAllArrows() {
        markers.forEach(marker => {
            if (marker.type === 'mevzii') {
                markers.forEach(target => {
                    if (target.type === 'hedef') {
                        drawArrow(marker.latlng, target.latlng, 'red', 5, 50, '10, 5', '0');
                    }
                });
            }
        });
    }

    document.getElementById('drawArrowsBtn').addEventListener('click', drawAllArrows);

    function clearArrows() {
        arrows.forEach(function(arrow) {
            map.removeLayer(arrow.polyline);
            map.removeLayer(arrow.arrowHead);
        });
        arrows = [];
    }
    document.getElementById('clearArrowsBtn').addEventListener('click', clearArrows);

    function visualizeResultsOnMap(results) {
        results.forEach(result => {
            var marker = markers.find(m => m.id === result.id);
            if (marker) {
                var color = result.canShoot ? 'green' : 'red';
                marker.circle.setStyle({color: color, fillColor: color});
            }
        });
    }

    function clearVisualizationResults() {
        markers.forEach(marker => {
            if (marker.circle) {
                var defaultColor = marker.type === 'mevzii' ? 'blue' : marker.type === 'kisitlama' ? 'green' : 'gray';
                marker.circle.setStyle({
                    color: defaultColor,
                    fillColor: defaultColor
                });

                var iconHtml = `<div style='position: relative;'>
                                    <div style='position: absolute; top: -24px; left: -50%; width: 100px; text-align: center; background-color: white; color: black; border-radius: 5px; padding: 2px;'>
                                        ${marker.label}
                                    </div>
                                    <div style='background-color:${defaultColor}; width:12px; height:12px; border-radius:50%;'></div>
                                </div>`;
                marker.marker.setIcon(L.divIcon({
                    className: 'custom-div-icon',
                    html: iconHtml,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                }));
            }
        });
    }

    document.getElementById('clearResultsBtn').addEventListener('click', clearVisualizationResults);

    // Kriter ağırlıklarının güncellenmesi
    document.getElementById('updateCriteriaBtn').addEventListener('click', function() {
        criteriaWeights.cost = parseFloat(document.getElementById('costWeight').value);
        criteriaWeights.range = parseFloat(document.getElementById('rangeWeight').value);
        criteriaWeights.effectiveness = parseFloat(document.getElementById('effectivenessWeight').value);
        criteriaWeights.fireRate = parseFloat(document.getElementById('fireRateWeight').value);
        alert('Kriter ağırlıkları güncellendi.');
    });

    // Kriter ağırlıkları
    const criteriaWeights = {
        cost: 0.25,
        range: 0.25,
        effectiveness: 0.25,
        fireRate: 0.25
    };

    // ARAS yöntemi ile toplam puan hesaplama
    function calculateARAS(scores, weights) {
        return scores.map(score => {
            const totalScore = Object.keys(weights).reduce((sum, criterion) => {
                if (criterion === 'cost' || criterion === 'range') {
                    return sum - score[criterion] * weights[criterion];
                } else {
                    return sum + score[criterion] * weights[criterion];
                }
            }, 0);
            return { id: score.id, totalScore: totalScore };
        });
    }

    // Mevzi puanları
    function getMevziScores() {
        return markers.filter(marker => marker.type === 'mevzii').map(marker => {
            var id = marker.id;
            var range = mevziMenzilleri[id - 1].range || 0;
            var cost = mevziMenzilleri[id - 1].cost || 0;
            var effectiveness = mevziMenzilleri[id - 1].effectiveness || 0;
            var fireRate = mevziMenzilleri[id - 1].fireRate || 0;
            return { id, range, cost, effectiveness, fireRate };
        });
    }

    function displayRankedMevzis(rankedMevzis) {
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '<h3>Mevzi Önceliklendirme Sonuçları</h3>';
        rankedMevzis.forEach(mevzi => {
            const mevziDiv = document.createElement('div');
            var marker = markers.find(m => m.id === mevzi.id);
            mevziDiv.textContent = `Mevzi: ${marker ? marker.label : mevzi.id}, Toplam Puan: ${mevzi.totalScore.toFixed(2)}`;
            resultsDiv.appendChild(mevziDiv);
        });
    }

    document.getElementById('analyzeButton').addEventListener('click', function() {
        const mevziScores = getMevziScores();
        const rankedMevzis = calculateARAS(mevziScores, criteriaWeights).sort((a, b) => b.totalScore - a.totalScore);
        displayRankedMevzis(rankedMevzis);
        exportResultsToExcel(rankedMevzis);
    });
});

const criteriaWeights = {
    cost: 0.25,
    range: 0.25,
    effectiveness: 0.25,
    fireRate: 0.25
};

// Kriter ağırlıklarının güncellenmesi
document.getElementById('updateCriteriaBtn').addEventListener('click', function() {
    criteriaWeights.cost = parseFloat(document.getElementById('costWeight').value);
    criteriaWeights.range = parseFloat(document.getElementById('rangeWeight').value);
    criteriaWeights.effectiveness = parseFloat(document.getElementById('effectivenessWeight').value);
    criteriaWeights.fireRate = parseFloat(document.getElementById('fireRateWeight').value);
    alert('Kriter ağırlıkları güncellendi.');
});

// ARAS yöntemi ile toplam puan hesaplama
function calculateARAS(scores, weights) {
    return scores.map(score => {
        const totalScore = Object.keys(weights).reduce((sum, criterion) => {
            if (criterion === 'cost' || criterion === 'range') {
                return sum - score[criterion] * weights[criterion];
            } else {
                return sum + score[criterion] * weights[criterion];
            }
        }, 0);
        return { id: score.id, totalScore: totalScore };
    });
}

// Mevzi puanları
function getMevziScores() {
    return markers.filter(marker => marker.type === 'mevzii').map(marker => {
        var id = marker.id;
        var range = mevziMenzilleri[id - 1].range || 0;
        var cost = mevziMenzilleri[id - 1].cost || 0;
        var effectiveness = mevziMenzilleri[id - 1].effectiveness || 0;
        var fireRate = mevziMenzilleri[id - 1].fireRate || 0;
        return { id, range, cost, effectiveness, fireRate };
    });
}

function displayRankedMevzis(rankedMevzis) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<h3>Mevzi Önceliklendirme Sonuçları</h3>';
    
    const selectedTargetId = document.getElementById('targetSelection').value;
    const selectedTarget = markers.find(marker => marker.id == selectedTargetId);
    if (!selectedTarget) {
        alert('Seçilen hedef bulunamadı.');
        return;
    }

    rankedMevzis.forEach(mevzi => {
        const mevziDiv = document.createElement('div');
        var marker = markers.find(m => m.id === mevzi.id);
        
        if (marker) {
            const distance = haversineDistance(marker.latlng, selectedTarget.latlng).toFixed(2);
            mevziDiv.textContent = `Mevzi: ${marker.label}, Toplam Puan: ${mevzi.totalScore.toFixed(2)}, Mesafe: ${distance} m`;
        } else {
            mevziDiv.textContent = `Mevzi: ${mevzi.id}, Toplam Puan: ${mevzi.totalScore.toFixed(2)}, Mesafe: Bilinmiyor`;
        }
        
        resultsDiv.appendChild(mevziDiv);
    });
}

function haversineDistance(coords1, coords2) {
    function toRad(x) {
        return x * Math.PI / 180;
    }

    var lat1 = coords1.lat;
    var lon1 = coords1.lng;
    var lat2 = coords2.lat;
    var lon2 = coords2.lng;

    var R = 6371000; // Earth's radius in meters
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}


document.getElementById('analyzeButton').addEventListener('click', function() {
    const mevziScores = getMevziScores();
    const rankedMevzis = calculateARAS(mevziScores, criteriaWeights).sort((a, b) => b.totalScore - a.totalScore);
    displayRankedMevzis(rankedMevzis);
    exportResultsToExcel(rankedMevzis);
});
