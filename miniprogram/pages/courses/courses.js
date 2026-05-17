const api = require('../../utils/api');

Page({
  data: {
    courses: [],
    selectedCourse: null
  },

  onLoad(query) {
    if (query.course) {
      this.openCourseById(query.course);
    } else {
      this.loadCourses();
    }
  },

  async loadCourses() {
    try {
      const courses = await api.getCourses();
      this.setData({ courses: courses || [] });
    } catch (err) {
      wx.showToast({ title: '课程加载失败', icon: 'none' });
    }
  },

  openCourse(e) {
    this.openCourseById(e.currentTarget.dataset.id);
  },

  async openCourseById(id) {
    try {
      const selectedCourse = await api.getCourseDetail(id);
      this.setData({ selectedCourse });
    } catch (err) {
      wx.showToast({ title: '课程详情加载失败', icon: 'none' });
    }
  },

  openLesson(e) {
    const { id, title } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/lesson/lesson?id=${id}&title=${encodeURIComponent(title)}` });
  }
});
