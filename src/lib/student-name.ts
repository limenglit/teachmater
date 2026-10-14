/** 统一姓名：全角空格转半角、合并空白、去首尾空格。 */
export const normalizeStudentName = (value: string) => value.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
