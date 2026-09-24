const db = require("../config/db");

// ============================================================
// CREATE SHOP LAYOUT
// ============================================================

exports.createLayout = async (req, res) => {
  try {
    const {
      business_id,
      shop_name,
      shop_type = "Grocery",
      width,
      length,
      height = 10,
      unit = "feet",
      entrance_side = "front",
      template = "smart",
      ai_optimization = true,
    } = req.body;

    // -----------------------------
    // Validation
    // -----------------------------

    if (!business_id) {
      return res.status(400).json({
        success: false,
        message: "business_id is required",
      });
    }

    if (!shop_name || !shop_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Shop name is required",
      });
    }

    if (!width || Number(width) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Width must be greater than 0",
      });
    }

    if (!length || Number(length) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Length must be greater than 0",
      });
    }

    if (!height || Number(height) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Height must be greater than 0",
      });
    }

    // -----------------------------
    // Insert layout
    // -----------------------------

    const [result] = await db.query(
      `
      INSERT INTO shop_layouts
      (
        business_id,
        shop_name,
        shop_type,
        width,
        length,
        height,
        unit,
        entrance_side,
        template,
        ai_optimization
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        business_id,
        shop_name.trim(),
        shop_type,
        Number(width),
        Number(length),
        Number(height),
        unit,
        entrance_side,
        template,
        ai_optimization ? 1 : 0,
      ]
    );

    res.json({
      success: true,
      layoutId: result.insertId,
      message: "Shop layout created successfully",
    });
  } catch (err) {
    console.error("createLayout error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// ============================================================
// GET LAYOUT BY BUSINESS ID
// ============================================================

exports.getLayout = async (req, res) => {
  try {
    const { businessId } = req.params;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "businessId is required",
      });
    }

    const [layoutRows] = await db.query(
      `
      SELECT *
      FROM shop_layouts
      WHERE business_id = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [businessId]
    );

    if (layoutRows.length === 0) {
      return res.json({
        layout: null,
        objects: [],
      });
    }

    const layout = layoutRows[0];

    const [objects] = await db.query(
      `
      SELECT *
      FROM shop_objects
      WHERE layout_id = ?
      ORDER BY id ASC
      `,
      [layout.id]
    );

    res.json({
      success: true,
      layout,
      objects,
    });
  } catch (err) {
    console.error("getLayout error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// ============================================================
// GET EXACT LAYOUT BY LAYOUT ID
// ============================================================

exports.getLayoutById = async (req, res) => {
  try {
    const { layoutId } = req.params;

    if (!layoutId) {
      return res.status(400).json({
        success: false,
        message: "layoutId is required",
      });
    }

    const [layoutRows] = await db.query(
      `
      SELECT *
      FROM shop_layouts
      WHERE id = ?
      LIMIT 1
      `,
      [layoutId]
    );

    if (layoutRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Layout not found",
      });
    }

    const layout = layoutRows[0];

    const [objects] = await db.query(
      `
      SELECT *
      FROM shop_objects
      WHERE layout_id = ?
      ORDER BY id ASC
      `,
      [layout.id]
    );

    res.json({
      success: true,
      layout,
      objects,
    });
  } catch (err) {
    console.error("getLayoutById error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// ============================================================
// ADD SHOP OBJECT
// ============================================================

exports.addObject = async (req, res) => {
  try {
    const {
      layout_id,
      object_type,
      object_name,
      x = 0,
      y = 0,
      z = 0,
      rotation = 0,
      width = 1,
      height = 1,
      depth = 1,
      color = "#8B4513",
    } = req.body;

    if (!layout_id) {
      return res.status(400).json({
        success: false,
        message: "layout_id is required",
      });
    }

    if (!object_type) {
      return res.status(400).json({
        success: false,
        message: "object_type is required",
      });
    }

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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        layout_id,
        object_type,
        object_name || object_type,
        Number(x),
        Number(y),
        Number(z),
        Number(rotation),
        Number(width),
        Number(height),
        Number(depth),
        color,
      ]
    );

    res.json({
      success: true,
      id: result.insertId,
      message: "Object added successfully",
    });
  } catch (err) {
    console.error("addObject error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// ============================================================
// UPDATE OBJECT
// ============================================================

exports.updateObject = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      x = 0,
      y = 0,
      z = 0,
      rotation = 0,
      width = 1,
      height = 1,
      depth = 1,
      color = "#8B4513",
      object_name,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Object ID is required",
      });
    }

    const [result] = await db.query(
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
        Number(x),
        Number(y),
        Number(z),
        Number(rotation),
        Number(width),
        Number(height),
        Number(depth),
        color,
        object_name || "Object",
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Object not found",
      });
    }

    res.json({
      success: true,
      message: "Object updated successfully",
    });
  } catch (err) {
    console.error("updateObject error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// ============================================================
// GET OBJECT
// ============================================================

exports.getObject = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT *
      FROM shop_objects
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Object not found",
      });
    }

    res.json({
      success: true,
      object: rows[0],
    });
  } catch (err) {
    console.error("getObject error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// ============================================================
// DELETE OBJECT
// ============================================================

exports.deleteObject = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      `
      DELETE FROM shop_objects
      WHERE id = ?
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Object not found",
      });
    }

    res.json({
      success: true,
      message: "Object deleted successfully",
    });
  } catch (err) {
    console.error("deleteObject error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// ============================================================
// DUPLICATE OBJECT
// ============================================================

exports.duplicateObject = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT *
      FROM shop_objects
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Object not found",
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        obj.layout_id,
        obj.object_type,
        `${obj.object_name || obj.object_type} Copy`,
        Number(obj.x || 0) + 2,
        obj.y,
        obj.z,
        obj.rotation,
        obj.width,
        obj.height,
        obj.depth,
        obj.color,
      ]
    );

    const newObjectId =
      result.insertId;

    const [newRows] = await db.query(
      `
      SELECT *
      FROM shop_objects
      WHERE id = ?
      `,
      [newObjectId]
    );

    res.json({
      success: true,
      id: newObjectId,
      object: newRows[0],
      message:
        "Object duplicated successfully",
    });
  } catch (err) {
    console.error(
      "duplicateObject error:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// ============================================================
// ROTATE OBJECT
// ============================================================

exports.rotateObject = async (req, res) => {
  try {
    const { id } = req.params;
    const { rotation } = req.body;

    if (rotation === undefined) {
      return res.status(400).json({
        success: false,
        message: "rotation is required",
      });
    }

    const [result] = await db.query(
      `
      UPDATE shop_objects
      SET rotation = ?
      WHERE id = ?
      `,
      [
        Number(rotation),
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Object not found",
      });
    }

    res.json({
      success: true,
      message:
        "Object rotated successfully",
    });
  } catch (err) {
    console.error(
      "rotateObject error:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// ============================================================
// ASSIGN PRODUCT TO SHOP OBJECT
// ============================================================

exports.assignProduct = async (req, res) => {
  try {
    const {
      product_id,
      object_id,
      shelf_slot,
      quantity = 1,
    } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: "product_id is required",
      });
    }

    if (!object_id) {
      return res.status(400).json({
        success: false,
        message: "object_id is required",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO product_positions
      (
        product_id,
        object_id,
        shelf_slot,
        quantity
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        product_id,
        object_id,
        shelf_slot || null,
        Number(quantity),
      ]
    );

    res.json({
      success: true,
      id: result.insertId,
      message:
        "Product assigned successfully",
    });
  } catch (err) {
    console.error(
      "assignProduct error:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// ============================================================
// FIND PRODUCT LOCATION
// ============================================================

exports.findProduct = async (req, res) => {
  try {
    const { productId } =
      req.params;

    const [result] = await db.query(
      `
      SELECT
        p.id AS product_id,
        p.product_name,

        o.id AS object_id,
        o.object_name,
        o.object_type,

        o.x,
        o.y,
        o.z,

        pp.shelf_slot,
        pp.quantity

      FROM product_positions pp

      JOIN products p
        ON p.id = pp.product_id

      JOIN shop_objects o
        ON o.id = pp.object_id

      WHERE p.id = ?

      ORDER BY pp.id DESC
      `,
      [productId]
    );

    res.json({
      success: true,
      results: result,
    });
  } catch (err) {
    console.error(
      "findProduct error:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// ============================================================
// DELETE PRODUCT POSITION
// ============================================================

exports.removeProductPosition = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      `
      DELETE FROM product_positions
      WHERE id = ?
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Product position not found",
      });
    }

    res.json({
      success: true,
      message:
        "Product position removed",
    });
  } catch (err) {
    console.error(
      "removeProductPosition error:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};