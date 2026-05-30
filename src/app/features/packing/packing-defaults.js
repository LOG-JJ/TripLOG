function getDefaultPackingList() {
  return [
    { id: "pack-1", name: "여권", checked: false },
    { id: "pack-2", name: "보조배터리", checked: false },
    { id: "pack-3", name: "비상약", checked: false },
    { id: "pack-4", name: "세면도구", checked: false },
    { id: "pack-5", name: "충전 케이블", checked: false },
    { id: "pack-6", name: "여벌 옷", checked: false },
  ];
}

window.TripLog.register("features.packing.defaults", {
  getDefaultPackingList,
});
