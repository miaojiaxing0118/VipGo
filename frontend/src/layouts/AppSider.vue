<template>
  <a-layout id="app-layout-sider">
    <a-layout-sider
      v-model="collapsed"
      theme="light"
      class="layout-sider"
      width="100">
      <div class="logo" @click="initData" style="user-select: none">
        <img class="pic-logo" src="~@/assets/logo.png">
      </div>
      <a-menu
        class="menu-item"
        theme="light"
        mode="inline"
        :selectedKeys="[current]"
        @click="menuHandle">
        <a-menu-item v-for="(menuInfo, index) in menu" :key="index" style="user-select: none">
          <icon-font :type="menuInfo.icon"/>
          {{ menuInfo.title }}
        </a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-content class="layout-content">
        <router-view v-slot="{ Component }" :key="cacheKey()">
          <keep-alive>
            <component :is="Component"/>
          </keep-alive>
        </router-view>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>
<script>
import axios from 'axios';
import CryptoJS from 'crypto-js'

export default {
  name: 'AppSider',
  data() {
    return {
      base_url: "",
      collapsed: true,
      current: 'menu_0',
      menu: {
        'menu_0': {
          icon: "icon-fengzheng",
          title: "主页",
          pageName: "Home",
          params: {}
        },
        'menu_1': {
          icon: "icon-paopao",
          title: "下载",
          pageName: "Download",
          params: {
            url: "https://im1907.top/?jx="
          },
        },
        'menu_2': {
          icon: "icon-niudan",
          title: "嗅探",
          pageName: "Web",
          params: {
            url: "https://im1907.top/?jx="
          },
        },
        'menu_3': {
          icon: "icon-liwu",
          title: "播放",
          pageName: "Video",
          params: {},
        }
      }
    };
  },
  watch: {
    // 监听路由对象$route的变化
    '$route': {
      handler: function (to, from) {
        if (to.path === '/video') {
          this.selectUrlByUrl()
        }
      },
      deep: true
    }
  },
  created() {
    this.base_url = import.meta.env.VITE_BASE_API_URL
    this.initData()
    this.menuHandle()
  },
  methods: {
    cacheKey() {
      if (this.$route.fullPath.startsWith("/tools")) {
        return this.$route.fullPath
      }
      return ""
    },
    menuHandle(e) {
      console.info("menuHandle============")
      this.current = e ? e.key : this.current;
      const linkInfo = this.menu[this.current]
      if (linkInfo['is_full_screen']) {
        try {
          window.electronApi.setFullScreen(true, linkInfo.params.url)
        } catch (e) {
        }
        return
      }
      this.$router.push({
        name: linkInfo.pageName,
        state: linkInfo.params,
        params: linkInfo.params,
        query: {
          t: CryptoJS.MD5(linkInfo.params.url).toString()
        }
      })
    },
    changeMenu(e) {
      this.current = e.key;
    },
    initData() {
      axios.post(this.base_url + "/getItemAll?key=menu_list")
        .then(res => {
          const new_data = res.data.data
          const new_object = {}
          let is_current = false
          for (let i = 0; i < new_data.length; i++) {
            new_object['menu_' + i] = new_data[i]
            if (this.current === 'menu_' + i) {
              is_current = true
            }
          }
          this.menu = new_object
          if (!is_current) {
            this.current = 'menu_0'
          }
          this.menuHandle({key: this.current})
        })
        .catch(err => {
        })
    },
    selectUrlByUrl() {
      for (const key in this.menu) {
        if (this.menu[key]['pageName'] === 'Video') {
          this.current = key
          return true;
        }
      }
    }
  },
};
</script>
<style lang="less" scoped>
// 嵌套
#app-layout-sider {
  height: 100%;

  .logo {
    border-bottom: 1px solid #e8e8e8;
  }

  .pic-logo {
    height: 32px;
    margin: 10px;
  }

  .layout-sider {
    border-top: 1px solid #e8e8e8;
    border-right: 1px solid #e8e8e8;
  }

  .menu-item {
    .ant-menu-item {
      background-color: #fff;
      margin-top: 0px;
      margin-bottom: 0px;
      padding: 0 0px !important;
    }
  }
}
</style>
