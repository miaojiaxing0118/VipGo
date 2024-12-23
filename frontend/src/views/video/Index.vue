<template>
  <div id="app-cross-go">
    <div id="video"></div>
    <a-button class="a_input" @click="clickMenu()">
      <menu-unfold-outlined/>
    </a-button>
    <a-layout-sider v-if="isShow" id="list" style="overflow-y: scroll">
      <a-list-item class="item" v-for="(item, index) in list" @click="clickItem(index)">
        <div v-if="name!==item" style="color: #333">{{ item.replace(".mp4", "") }}</div>
        <div v-if="name===item" style="color: #29cf74">{{ item.replace(".mp4", "") }}</div>
      </a-list-item>
      <a-empty v-if="list.length===0" style="margin-top: 50%;color: #555555;user-select: none" description="暂无数据"/>
    </a-layout-sider>
    <div style="z-index: 999;position: fixed;top: 10px; left: 110px;color: white">{{ name }}</div>
  </div>
</template>
<script>
import axios from "axios";
import Player from 'xgplayer';
import 'xgplayer/dist/index.min.css';

export default {
  data() {
    return {
      isShow: false,
      currentTimeNative: 30,
      name: '',
      oldName: '',
      base_url: '',
      videoUrl: '',
      fileList: [],
      list: [],
      video_list: [],
      video_list_url: [],
      player: {},
      options: {
        id: 'video',
        url: '',
        height: '100%',
        width: '100%',
        autoplay: true, //自动播放
        volume: 0.5,
        playNext: {urlList: []}
      }
    };
  },
  created() {
    this.base_url = "http://127.0.0.1:3300"
    this.initDataPre()

  },
  mounted() {
    this.initPlay()
  },
  activated() {
    // console.log("activated", history.state.name)
    let cName = history.state.name
    if (cName && cName !== this.oldName) {
      this.initDataPre()
    } else {
      if (this.player.paused) {
        this.player.play()
      }
    }
  },
  methods: {
    initDataPre() {
      this.oldName = history.state.name
      this.name = history.state.name
      if (this.name) {
        this.$store.commit("setLastPlayVideoInfo", {name: this.name})
      } else {
        if (this.$store.state.lastPlayVideoInfo['name']) {
          this.name = this.$store.state.lastPlayVideoInfo['name']
        }
      }
      this.initData(true)
      try {
        window.electronApi.getPort().then(port => {
          let newBaseUrl = "http://127.0.0.1" + ":" + port
          if (newBaseUrl !== this.base_url) {
            this.base_url = newBaseUrl
            this.initData(true)
          }
        })
      } catch (e) {
      }
    },

    initPlay() {
      let _this = this;
      this.player = new Player(this.options);
      this.player.on('play', (data) => {
        _this.name = _this.getCurrentTitle(_this.player.src)
      })
      this.player.on('ended', (data) => {
        _this.nextPlay()
      })
      this.player.on('playnext', (data) => {
        _this.nextPlay()
      })
    },
    nextPlay() {
      const url = this.getNextUrl(this.options.url)
      this.play(url)
    },
    play(url) {
      this.options.url = url
      this.player.resetState()
      this.player.setConfig(this.options)
      this.player.reload()
      this.player.play()
      this.player.currentTime = this.currentTimeNative
    },
    getNextUrl(url) {
      for (let i = 0; i < this.video_list.length; i++) {
        if (url && url === this.video_list[i]['url']) {
          if ((i + 1) <= this.video_list.length - 1) {
            return this.video_list[i + 1]['url']
          }
        }
      }
      if (this.video_list.length > 0) {
        return this.video_list[0]['url']
      }
      return ""
    },
    getCurrentTitle(url) {
      for (let i = 0; i < this.video_list.length; i++) {
        if (url && url === this.video_list[i]['url']) {
          return this.video_list[i]['title']
        }
      }
    },
    clickMenu() {
      this.isShow = !this.isShow
      if (this.isShow) {
        this.initData(false)
      }
    },
    clickItem(index) {
      this.videoUrl = this.video_list[index].url;
      this.name = this.video_list[index]['title'];
      this.isShow = false
      this.$store.commit("setLastPlayVideoInfo", {name: this.name})
      this.play(this.videoUrl)
    },
    initData(isPlay) {
      axios.get(this.base_url + "/api")
        .then(res => {
          const new_data = res.data
          let list = []
          let new_video_list_url = []
          for (let index in new_data) {
            list.push(new_data[index]['title'])
            new_video_list_url.push(new_data[index]['url'])
          }
          this.list = list
          this.video_list = new_data
          this.video_list_url = new_video_list_url

          if (this.video_list.length === 0) {
            return;
          }
          this.options.playNext.urlList = this.video_list_url

          for (let i = 0; i < this.video_list.length; i++) {
            // console.log("initData", this.video_list[i], this.name)
            if (this.name && this.name === this.video_list[i]['title']) {
              this.videoUrl = this.video_list[i]['url'];
              if (isPlay) {
                this.options.url = this.videoUrl
                this.initPlay()
                this.player.play()
                this.player.currentTime = this.currentTimeNative
              }
              return
            }
          }
          this.videoUrl = this.video_list[0]['url'];
          this.name = this.video_list[0]['title'];
          if (isPlay) {
            this.options.url = this.videoUrl
            this.initPlay()
            this.player.play()
            this.player.currentTime = this.currentTimeNative
          }
        })
        .catch(err => {
        })
    }
  }
};
</script>
<style lang="less" scoped>
#app-cross-go {
  padding: 0;
  text-align: left;
  width: 100%;
  height: 100%;
  display: flex;
  background-color: black;
  flex-direction: column;
  color: white;

  .a_input {
    position: fixed;
    top: 15px;
    right: 15px;
    z-index: 999;
  }

  #list {
    background-color: white;
    width: 200px;
    position: fixed;
    top: 10px;
    right: 10px;
    bottom: 15px;
    z-index: 998;
    border-radius: 5px;
  }

  #video {
    width: 100%;
    height: 100%;
  }

  .item {
    padding: 10px;
    border-bottom: 1px solid #eee;
    font-size: 9pt;
  }
}
</style>
