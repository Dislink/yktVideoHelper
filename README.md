# 雨课堂视频网课刷课脚本
---
### 纯后端 基于nodejs
本来想做成前端兼容的，但是实际上会引发跨域问题就放弃了
## 使用方法
1. 下载nodejs
2. 安装`qrcode-terminal`模块和`ws`模块通过  
    ```
    npm i qrcode-terminal
    npm i ws
    ```
3. 执行ykt.js
    ```
    node ykt.js
    ```
4. 按照指引登录和刷课
## 注意事项
* 第一次扫码登录后程序会在当前目录生成`USERDATA.txt`记录用户口令信息，后续登录无需再次扫码。如果遇到连续的登录错误或想要切换用户，可以删除这个文件。
* 视频刷课过程设计为尽量在一次请求内完成一次视频的观看记录，速度会比较快，如果你没有修改代码的能力并且不确定学校是否会**检查视频开始播放和完成播放时间**，自行决定是否使用这个脚本。
* 这个脚本对 **中南大学** **大学生心理健康教育** 课程经测试可用，理论上对其他学校其他课程也可用，但**未经过测试**。如果你想，可以提issue记录它对其他学校和课程是否可用。
* 如果运行出错并确定**并非网络问题**，首先**检查是否安装好node和要求的模块**，然后尝试重新运行。重新运行*超过三次*依然报错，可以提交issue。issue**必须包含运行报错截图**，我会在看到后第一时间解决。
* 如果你的雨课堂显示视频未完全看完，可以尝试重新运行。

### 可爱小正太加我