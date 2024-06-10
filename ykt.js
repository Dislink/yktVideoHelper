const websocket=require('ws');
const qrcode=require('qrcode-terminal');
const fs=require('fs');


(async ()=>{

        async function _retryFetch(url, options, retry=3, evaluate=undefined){
            let data;
            do{
                try{
                    data=await (await fetch(url,options)).json();
                }catch(e){
                    console.error(e)
                }
                if(retry--<=0){
                    throw new Error("Fetch failed(max retry time excedded)."+(JSON.stringify(data)||''));
                }
            }while(!data||(evaluate&&!evaluate(data)))
            return data;
        }

        let headers={
            "content-type": 'application/json',
            "uv-id": 2952,
            "xt-agent": "web",
            "xtbz": "ykt"
        };

        //请求登录数据
        let userData=await new Promise((resolve,reject)=>{
            if(fs.existsSync("USERDATA.txt")){
                let userData=fs.readFileSync("USERDATA.txt");
                resolve(userData);
            }else{
                ws=new websocket("wss://www.yuketang.cn/wsapp/");
                ws.on("open",()=>{
                    ws.send(JSON.stringify({
                        'op':"requestlogin",
                        'role': "web",
                        "version": 1.4,
                        "type": "qrcode",
                        "from": "web"
                    }))
                })
                let refresh;
                ws.on("message",async (data)=>{
                    data=JSON.parse(data);
                    if(data.op=="requestlogin"){
                        refresh=setTimeout(()=>{
                            ws.send(JSON.stringify({
                                'op':"requestlogin",
                                'role': "web",
                                "version": 1.4,
                                "type": "qrcode",
                                "from": "web"
                            }));
                            console.log("二维码已过期，重新请求二维码。");
                        },1000*data.expire_seconds);
                        console.log("请使用微信扫描二维码登录。");
                        console.log(data.ticket);
                        qrcode.generate(atob(data.ticket.match(/ticket\=(.+)$/)[1]).slice(14,59),{small:true});
                    }else if(data.op=="loginsuccess"){
                        clearTimeout(refresh);
                        ws.close();
                        let userData=JSON.stringify({
                            "UserID": data.UserID,
                            "Auth": data.Auth,
                        })
                        fs.writeFileSync("USERDATA.txt", userData);
                        resolve(userData);
                    }else{
                        console.log("未知消息");
                        console.log(data);
                    }
                })
            }
        });

        //登录
        let loginResponse=await fetch("https://www.yuketang.cn/pc/web_login",{
            method: 'POST',
            headers: headers,
            body: userData
        });
        headers["cookie"]=loginResponse.headers.getSetCookie().join(';')
        if(headers["cookie"]){
            console.log("登录成功!");
        }else{
            console.error("登录失败!");
            process.exit();
        }



        //获取用户信息
        let userInfo=await _retryFetch("https://www.yuketang.cn/v2/api/web/userinfo",{method:'GET',headers: headers}, 3, (d)=>{return !d.errcode});
        if(!userInfo){
            console.error("无法获取用户信息！");
            process.exit();
        }

        console.log(`用户名：${userInfo.data[0].name}   学号：${userInfo.data[0].school_number}`);


        //获取课程信息
        let courseList=await _retryFetch("https://www.yuketang.cn/v2/api/web/courses/list?identity=2",{method:'GET',headers: headers}, 3, (d)=>{return !d.errcode});
        if(!courseList){
            console.log("无法获取课程列表！");
            process.exit();
        }
        courseList = courseList.data.list;
        console.log("课程列表:");
        for(i in courseList){
            console.log(`    [${i}]:  \x1b[32m${courseList[i].course.name}\x1b[0m[${courseList[i].name}] - ${courseList[i].teacher.name}`);
        }

        //选择课程
        console.log("请输入课程编号:");
        let choice=await new Promise((resolve,reject)=>{
            process.stdin.setEncoding('utf8');
            process.stdin.on('data',(chunk)=>{
                if(chunk!==null&&parseInt(chunk)>=0&&parseInt(chunk)<courseList.length){
                    resolve(parseInt(chunk));
                }else{
                    console.log("请输入正确的课程编号:");
                }
            })
        });

        console.log(`已选择课程: \x1b[32m${courseList[choice].course.name}\x1b[0m[${courseList[choice].name}] - ${courseList[choice].teacher.name}`);
        let classroomID=courseList[choice].classroom_id.toString();
        headers["Classroom-Id"]=classroomID;
        headers.cookie+=`;classroom_id=${classroomID};classroomId=${classroomID}`;
        
        //获取详细课程信息
        console.log("正在获取详细课程信息...");
        let courseData=await _retryFetch(`https://www.yuketang.cn/v2/api/web/classrooms/${classroomID}?role=5`,{method:'GET',headers: headers}, 3, (d)=>{return d?.data?.free_sku_id});
        if(!courseData){
            console.error("无法获取详细课程信息！");
        }
        
        //获取用户成绩单信息
        console.log("正在获取用户成绩单信息...");
        let evaluationData=await _retryFetch(`https://www.yuketang.cn/c27/online_courseware/schedule/score_detail/single/${courseData.data.free_sku_id}/0/`,{method:'GET',headers: headers}, 3, (d)=>{return d?.data?.leaf_level_infos});
        if(!evaluationData){
            console.error("无法获取用户成绩单信息！");
            process.exit();
        }


        function _generateHeartbeatPacket(courseData, evaluationData, leaf, videoData, options={}){
            return {
                "i": 5,
                "et": options.et||"play",
                "p": "web",
                "n": "ali-cdn.xuetangx.com",
                "lob": "ykt",
                "cp": options.cp||0,
                "fp": 0,
                "tp": options.tp||0,
                "sp": 1,
                "ts": options.ts||0,
                "u": evaluationData.data.user.user_id,
                "uip": "",
                "c": courseData.data.course_id,
                "v": leaf.id,
                "skuid": courseData.data.free_sku_id,
                "classroomid": courseData.data.id.toString(),
                "cc": videoData.data.content_info.media.ccid,
                "d": options.d||0,
                "pg": leaf.id+"_tzof",
                "sq": options.sq||0,
                "t": "video",
                "cards_id": 0,
                "slide": 0,
                "v_url": ""
            }
        }

        //开始刷课
        for(leaf of evaluationData.data.leaf_level_infos){
            if(!leaf) continue
            if(leaf.leaf_type){
                console.log(`\x1b[33m${leaf.leaf_chapter_title} ${leaf.leaf_level_title} ${leaf.id}不是视频,跳过`)
                continue;
            };
            if(leaf.schedule>=1){
                console.log(`\x1b[34m${leaf.leaf_chapter_title} ${leaf.leaf_level_title} ${leaf.id}已完成,跳过`)
                continue;
            };

            //获取视频信息
            console.log(`\x1b[32m正在获取视频信息: \x1b[0m${leaf.leaf_chapter_title} ${leaf.leaf_level_title} ${leaf.id}`)
            let videoData=await _retryFetch(`https://www.yuketang.cn/mooc-api/v1/lms/learn/leaf_info/${courseData.data.id}/${leaf.id}/`,{
                method:'GET',
                headers: headers
            }, 3, (d)=>{return d?.data?.content_info?.media?.ccid});
            if(!videoData){
                console.error("无法获取视频信息！");
                process.exit();
            }
        
        
            var d=0;
            var heartbeatPackets={"heart_data": []};
            for(et of ["loadstart","loadeddata","play","playing","waiting","playing"]){
                heartbeatPackets.heart_data.push(_generateHeartbeatPacket(courseData, evaluationData, leaf, videoData, {ts:new Date().getTime().toString(), et:et, sq:heartbeatPackets.heart_data.length}))
            }
            await _retryFetch(`https://www.yuketang.cn/video-log/heartbeat/`,{
                method:'POST',
                headers: headers,
                body: JSON.stringify(heartbeatPackets)
            });
            progress=await _retryFetch(`https://www.yuketang.cn/video-log/get_video_watch_progress/?cid=${courseData.data.course_id}&user_id=${evaluationData.data.user.user_id}&classroom_id=${courseData.data.id}&video_type=video&vtype=rate&video_id=${leaf.id}&snapshot=1`,{
                method:'GET',
                headers: headers,
            }, 3, (d)=>{return d?.[leaf.id]?.video_length});
            if(!progress){
                console.error("无法获取进度信息！");
                process.exit();
            }
            playTime=progress[leaf.id]?.watch_length||0;
            beforeTime=playTime;
            d=progress[leaf.id]?.video_length||0;
            heartbeatPackets={"heart_data": []};
            await new Promise(async (resolve,reject)=>{
                intv=setInterval(async ()=>{
                    for(t=0;d?(playTime<d):(t<8);t++){
                        if(playTime>=d) break;
                        heartbeatPackets.heart_data.push(_generateHeartbeatPacket(courseData, evaluationData, leaf, videoData, {cp: playTime+20>=d?playTime=d:playTime+=20, tp: beforeTime, ts: (new Date().getTime()+t*3000).toString(), sq: heartbeatPackets.heart_data.length, d: d}))
                    }
                    process.stdout.write(".")
                    if(1){
                        if(playTime>=d){
                            clearInterval(intv);
                        }else{process.stdout.write(`${playTime}/${d}`)}
                        await _retryFetch(`https://www.yuketang.cn/video-log/heartbeat/`,{
                            method:'POST',
                            headers: headers,
                            body: JSON.stringify(heartbeatPackets)
                        });
                        progress=await _retryFetch(`https://www.yuketang.cn/video-log/get_video_watch_progress/?cid=${courseData.data.course_id}&user_id=${evaluationData.data.user.user_id}&classroom_id=${courseData.data.id}&video_type=video&vtype=rate&video_id=${leaf.id}&snapshot=1`,{
                            method:'GET',
                            headers: headers,
                        }, 3, (d)=>{return d?.[leaf.id]?.video_length});
                        if(!progress){
                            console.error("无法获取进度信息！");
                            process.exit();
                        }
                        if(progress[leaf.id]?.rate==1){
                            resolve();
                        }else{
                            if(playTime>=d&&progress[leaf.id]?.rate>0.9){
                                progress[leaf.id].rate=1;
                                resolve();
                            }
                        }
                        process.stdout.write(` \r\x1b[K\t-\x1b[32m课程 \x1b[0m${leaf.leaf_chapter_title} ${leaf.leaf_level_title} ${leaf.id}-\x1b[33m${playTime}/${d}(${((progress[leaf.id]?.rate||0)*100).toFixed(2)}%)\x1b[0m${progress[leaf.id]?.rate==1?'\n':''}`)
                        playTime=progress[leaf.id]?.watch_length;
                        beforeTime=playTime;
                        d=progress[leaf.id]?.video_length;
                        heartbeatPackets={"heart_data": []};
                    }
                },1000)
            })
        }
        console.log("\x1b[42;34m全部视频网课刷课完成！\x1b[0m");
        process.exit();
    })();