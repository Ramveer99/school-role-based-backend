export function applyIdTransform(schema) {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      ret.id = ret._id?.toString?.() || ret._id;
      delete ret._id;
      delete ret.password;
      return ret;
    },
  });
  schema.set('toObject', {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      ret.id = ret._id?.toString?.() || ret._id;
      delete ret._id;
      delete ret.password;
      return ret;
    },
  });
}
