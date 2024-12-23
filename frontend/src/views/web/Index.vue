<template>
  <div id="app-cross-go">
    <iframe class="iframe" :src="[url]"></iframe>
    <a-layout-sider id="list" style="overflow-y: scroll;user-select: none;">
      <a-list-item class="item" v-for="(item, index) in list">
        <div style="display: flex;flex-direction: row">{{ item.name }}
          <div style="margin-left: 3px;font-size: 9pt"> {{ item.year }}</div>
        </div>
        <div style="margin-top: 5px;background-color: #eee;height: 1px;margin-bottom: 5px"></div>
        <div class="div_item_2">
          <div v-if="item['source']" class="item_2" v-for="(item_2, index) in item['source']['eps']"
               @click="clickItem(item_2,item.name)">
            <div tabindex="1" class="list_item_name">{{ item_2.name }}</div>
          </div>
        </div>
      </a-list-item>
      <a-empty v-if="list.length===0" style="margin-top: 50%;color: #555555;user-select: none" description="暂无数据"/>
    </a-layout-sider>
  </div>
</template>
<script>
import {message} from 'ant-design-vue';

export default {
  data() {
    return {
      isShow: false,
      base_url: '',
      src: '',
      videoUrl: '',
      fileList: [],
      list: [],
      video_list: []
    };
  },
  created() {
    this.base_url = "http://127.0.0.1:3000"
    this.videoUrl = ""
    this.$data.url = history.state.url
    this.list = this.$store.state.globalVideoList

    this.initData()

    try {
      window.electronApi.onUpdateList((value) => {
        console.log(value)
        this.$store.commit("setGlobalVideoList", value)
        this.list = value
      })
    } catch (e) {
    }
  },
  methods: {
    clickMenu() {
      this.isShow = !this.isShow
      if (this.isShow) {
        this.initData()
      }
    },
    clickItem(item, name) {
      console.log(item, name)
      let new_item = {
        name: name + "_" + item["name"],
        url: item["url"]
      }
      let new_task_item = {
        fileName: new_item.name,
        url: new_item.url,
        type: 1
      }
      let downloadProgressList = this.$store.state.downloadProgressList
      let isExist = false
      for (let i = 0; i < downloadProgressList.length; i++) {
        if (downloadProgressList[i]['fileName'] === new_task_item['fileName']) {
          isExist = true
          break
        }
      }
      if (!isExist) {
        this.$store.commit("addDownloadProgressList", new_task_item)
        message.info("添加下载任务成功!")
      } else {
        message.info("下载任务已存在!")
      }

      try {
        window.electronApi.addDownloadTask(new_item)
      } catch (e) {
        message.info("不支持下载...")
      }
    },
    initData() {
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
  flex-direction: row;
  color: white;

  #list {
    background-color: white;
    width: 280px;
    border-radius: 5px;
    margin: 10px;
  }

  .item {
    padding-left: 10px;
    padding-right: 5px;
    color: #333;
    font-size: 11pt;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .div_item_2 {
    display: flex;
    flex-wrap: wrap;
  }

  .item_2 {
    border: 1px solid #eee;
    padding: 2px 3px;
    margin: 2px 2px;
    border-radius: 5px;
    color: #555;
    font-size: 10pt;
    display: flex;
  }

  .iframe {
    height: 100%;
    flex-grow: 1;
    border-width: 0;
  }

  .list_item_name {
    color: #333;
  }

  .list_item_name:focus {
    color: #29cf74;
  }

}
</style>
