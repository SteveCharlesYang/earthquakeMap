const http = require('http');
const https = require('https');
const cheerio = require('cheerio');
const fs = require('fs');

const pageUrl = "http://news.ceic.ac.cn/index.html"

const gugu_ak = ''
const gugu_id = ''
const gugu_uid = ''
const min_m = 3.5
const max_dist = 300.0
const loc_lat = 30.753
const loc_lng = 103.934

http.get(pageUrl, function(res) {
    let html = '';
    res.on('data', function(data) {
        html += data;
    });
    res.on('end', function() {
        dealHTML(html);
    });
});

function dealHTML(html) {
    let $ = cheerio.load(html);
    let dataArr = [];
    
    $('#news').find('tr').each(function(index, element) {
        if (element.children.length == 13 && element.children instanceof Array) {
            let temp = []
            for (let i = 0; i < element.children.length; ++i) {
                let cur = element.children[i]
                if (cur.name == 'td') {

                    if (!cur.children[0].data){
                        temp.push("'" + cur.children[0].children[0].data + "'")
                    } else {
                        temp.push("'" + cur.children[0].data + "'")
                    }
                    
                }
            }
            dataArr.push(temp)
        }
    });
    writeFile(__dirname + '/output.json', dataArr)
}

function sendPrint(quake){
    var print = ' <-----BEGIN TRANSMISSION----->\nEARTHQUAKE ACTIVITY ALERT\nTIME:' + quake[1] + '\n--------INFO--------\nM LEVEL:' + quake[0] + '\nZONE:' + quake[5] + '\nDEPTH:' + quake[4] + ' km\n<-----END TRANSMISSION----->'
    var printStr = new Buffer(print);
    var post_data = JSON.stringify({
        'ak':gugu_ak,
	'timestamp': new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''),
	'printcontent':'T:'+require('iconv-lite').encode(printStr,'gbk').toString('base64'),
	'userID':gugu_uid,
        'memobirdID':gugu_id
    });
    var options = {
        hostname:'open.memobird.cn',
	port:443,
	path:'/home/printpaper',
	method:'POST',
	headers: {                      
	    'Content-Type':'application/json',
            'Content-Length': post_data.length
	}
    };
    let req_body=[];
    var req = https.request(options,function(res){
        res.on('error', (err) => {
	    console.log(err.stack);
	});
    });
    req.write(post_data);
    req.end();
    console.log('Print Success.');
}

function writeFile(file, data){  
    let str = '',
        headStr = '{"earthquake":[', //震级(M) 发震时刻(UTC+8) 纬度(°) 经度(°) 深度(千米) 地区 \n',
        footStr = '],"timestamp":"' + (new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')) + '"}\n'

    for (let i = 0; i < data.length - 1; ++i) {
        str += '[' + data[i] + ']' + ',' + '\n';
    }  
    str += '[' + data[data.length - 1] + ']' + '\n';
    str = headStr + str + footStr;
    str = str.replace(/\'/g,"\"");
    judgePrint(str);
    fs.writeFile(file, str,function(err, data){
        if(err) {
            console.log(file+'File Write Error:',err);
        } else {
            console.log("File Write Success.");
        }    
    });
}

function judgePrint(newStr){
    var jsonDiff = require('json-diff');
    oldFile = JSON.parse(fs.readFileSync(__dirname + '/output.json'));
    newFile = JSON.parse(newStr);
    diffRes = jsonDiff.diff(oldFile, newFile);
    if(typeof diffRes["earthquake"] !== "undefined"){
	console.log("Earthquake Detected.");
    	for (var i = 0; i < diffRes["earthquake"].length; i++){
    		if(diffRes["earthquake"][i][0] === '+'){
			console.log("Data checked.");
			let mLevel = parseFloat(diffRes["earthquake"][i][1][0]);
			if(mLevel > min_m){
				console.log('M Level checked.');
				distpos1 = parseFloat(diffRes["earthquake"][i][1][2]);
				distpos2 = parseFloat(diffRes["earthquake"][i][1][3]);
    				if(GetDistance(distpos1,distpos2,loc_lat,loc_lng)<max_dist){
					console.log('Dist checked.');
					sendPrint(diffRes["earthquake"][i][1]);
				}
			}
    		}
    	}
    }
    else{
    	console.log("Not Changed.");
    }
    
}
function GetDistance( lat1,  lng1,  lat2,  lng2){
	    var radLat1 = lat1*Math.PI / 180.0;
	    var radLat2 = lat2*Math.PI / 180.0;
	    var a = radLat1 - radLat2;
	    var  b = lng1*Math.PI / 180.0 - lng2*Math.PI / 180.0;
	    var s = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin(a/2),2) +
		        Math.cos(radLat1)*Math.cos(radLat2)*Math.pow(Math.sin(b/2),2)));
	    s = s *6378.137 ;// EARTH_RADIUS;
	    s = Math.round(s * 10000) / 10000;
	    return s;
}
