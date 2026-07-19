const db = require("../config/db");

exports.createLayout = async (req, res) => {
  try {
    const {
      business_id,
      shop_name,
      width,
      length
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO shop_layouts
      (business_id, shop_name, width, length)
      VALUES(?, ?, ?, ?)`,
      [business_id, shop_name, width, length]
    );

    res.json({
      success: true,
      layoutId: result.insertId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.getLayout = async (req, res) => {
  try {
    const { businessId } = req.params;

    const [layout] = await db.query(
      "SELECT * FROM shop_layouts WHERE business_id = ?",
      [businessId]
    );

    if (layout.length === 0) {
      return res.json([]);
    }

    const [objects] = await db.query(
      "SELECT * FROM shop_objects WHERE layout_id = ?",
      [layout[0].id]
    );

    res.json({
      layout: layout[0],
      objects
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.addObject = async (req, res) => {
  try {
    const {
      layout_id,
      object_type,
      object_name,
      x,
      y,
      z,
      rotation,
      width,
      height,
      depth,
      color
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO shop_objects
      (layout_id, object_type, object_name, x, y, z, rotation, width, height, depth, color)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        layout_id,
        object_type,
        object_name,
        x,
        y,
        z,
        rotation,
        width,
        height,
        depth,
        color
      ]
    );

    res.json({
      success: true,
      id: result.insertId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.updateObject = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      x,
      y,
      z,
      rotation,
      width,
      height,
      depth,
      color,
      object_name,
    } = req.body;

    await db.query(
      `
      UPDATE shop_objects
      SET
        x = ?,
        y = ?,
        z = ?,
        rotation = ?,
        width = ?,
        height = ?,
        depth = ?,
        color = ?,
        object_name = ?
      WHERE id = ?
      `,
      [
        x,
        y,
        z,
        rotation,
        width,
        height,
        depth,
        color,
        object_name,
        id,
      ]
    );

    res.json({
      success: true,
      message: "Object updated successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getObject = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM shop_objects WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Object not found",
      });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.deleteObject = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      "DELETE FROM shop_objects WHERE id = ?",
      [id]
    );

    res.json({
      success: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.duplicateObject = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM shop_objects WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Object not found"
      });
    }

    const obj = rows[0];

    const [result] = await db.query(
      `
      INSERT INTO shop_objects
      (
        layout_id,
        object_type,
        object_name,
        x,
        y,
        z,
        rotation,
        width,
        height,
        depth,
        color
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        obj.layout_id,
        obj.object_type,
        obj.object_name,
        obj.x + 2,
        obj.y,
        obj.z,
        obj.rotation,
        obj.width,
        obj.height,
        obj.depth,
        obj.color,
      ]
    );

    res.json({
      success: true,
      id: result.insertId,
      message: "Object duplicated successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.rotateObject = async (req, res) => {
  try {
    const { id } = req.params;
    const { rotation } = req.body;

    await db.query(
      `
      UPDATE shop_objects
      SET rotation = ?
      WHERE id = ?
      `,
      [rotation, id]
    );

    res.json({
      success: true,
      message: "Object rotated successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.assignProduct = async (req, res) => {
  try {
    const {
      product_id,
      object_id,
      shelf_slot,
      quantity
    } = req.body;

    await db.query(
      `INSERT INTO product_positions
      (product_id, object_id, shelf_slot, quantity)
      VALUES(?, ?, ?, ?)`,
      [
        product_id,
        object_id,
        shelf_slot,
        quantity
      ]
    );

    res.json({
      success: true,
      message: "Product assigned successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.findProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const [result] = await db.query(
      `
      SELECT
        p.product_name,
        o.object_name,
        o.object_type,
        o.x,
        o.y,
        o.z,
        pp.shelf_slot
      FROM product_positions pp
      JOIN products p ON p.id = pp.product_id
      JOIN shop_objects o ON o.id = pp.object_id
      WHERE p.id = ?
      `,
      [productId]
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};